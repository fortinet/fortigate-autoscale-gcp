terraform {
  required_providers {
    google = ">=3.16.0"
    google-beta = ">=3.15.0"
  }
}
provider "google" {
  credentials = "${file(var.auth_key)}"
  project     = "${var.project}"
  region      = "${var.region}"
  zone        = "${var.zone}"
}
provider "google-beta" {
  credentials = "${file(var.auth_key)}"
  project     = "${var.project}"
  region      = "${var.region}"
  zone        = "${var.zone}"
}

resource "random_string" "psk" {
  length           = 16
  special          = true
  override_special = ""
}
#Random 5 char string appended to the end of each name to avoid conflicts
resource "random_string" "random_name_post" {
  length           = 5
  special          = true
  override_special = ""
  min_lower        = 5
}
### VPC ###
resource "google_compute_network" "vpc_network" {
  name                    = "${var.cluster_name}-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "public_subnet" {
  name          = "${var.cluster_name}-public-subnet-${random_string.random_name_post.result}"
  region        = "${var.region}"
  network       = "${google_compute_network.vpc_network.self_link}"
  ip_cidr_range = "${var.public_subnet}"
}
resource "google_compute_address" "static" {
  name = "${var.cluster_name}-static-ip-${random_string.random_name_post.result}"
}
### Public VPC Firewall Policy ###
#Default direction is ingress
resource "google_compute_firewall" "firewall" {
  name    = "${var.cluster_name}-firewall-${random_string.random_name_post.result}"
  network = "${google_compute_network.vpc_network.name}"
  priority = "100"
  allow {
    protocol = "all"
  }

  source_ranges = ["${var.firewall_allowed_range}"]
}
### Public managment VPC ###
resource "google_compute_network" "public_managment_vpc_network" {
  name                    = "${var.cluster_name}-public-managment-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "public_managment_subnet" {
  name          = "${var.cluster_name}-public-managment-subnet-${random_string.random_name_post.result}"
  region        = "${var.region}"
  network       = "${google_compute_network.public_managment_vpc_network.self_link}"
  ip_cidr_range = "${var.public_managment_subnet}"
}
### Public managment VPC Firewall Policy ###
resource "google_compute_firewall" "public_managment_firewall" {
  name    = "${var.cluster_name}-firewall-public-managment-${random_string.random_name_post.result}"
  network = "${google_compute_network.public_managment_vpc_network.name}"
  priority = "100"
  allow {
    protocol = "all"
  }
  source_ranges = ["${var.firewall_allowed_range}"]
}

 ### Protected VPC ###
resource "google_compute_network" "protected_vpc_network" {
  name                    = "${var.cluster_name}-protected-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "protected_subnet" {
  name          = "${var.cluster_name}-protected-subnet-${random_string.random_name_post.result}"
  region        = "${var.region}"
  network       = "${google_compute_network.protected_vpc_network.self_link}"
  ip_cidr_range = "${var.protected_subnet}"

}
### Protected VPC Firewall Policy ###
#Default direction is ingress
resource "google_compute_firewall" "protected_firewall" {
  name    = "${var.cluster_name}-protected-vpc-firewall-${random_string.random_name_post.result}"
  network = "${google_compute_network.protected_vpc_network.name}"
  priority = "100"
  allow {
    protocol = "all"
  }

  source_ranges = ["${var.protected_firewall_allowed_range}"]
}
### Cloud Nat ###
# Allows for egress traffic on Protected Subnet
resource "google_compute_router_nat" "cloud_nat" {
  name                               = "${var.cluster_name}-cloud-nat-${random_string.random_name_post.result}"
  router                             = "${google_compute_router.protected_subnet_router.name}"
  region                             = "${var.region}"
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

}
resource "google_compute_router" "protected_subnet_router" {
  name    = "${var.cluster_name}-router-${random_string.random_name_post.result}"
  region  = "${var.region}"
  network = "${google_compute_network.protected_vpc_network.self_link}"
}

# Instance Template
resource "google_compute_instance_template" "default" {
  depends_on  = ["google_cloudfunctions_function.function"]
  name        = "${var.cluster_name}-instance-template-${random_string.random_name_post.result}"
  description = "Fortigate AutoScale Cluster"

  instance_description = "FortiGate AutoScale Cluster"
  machine_type         = "${var.instance}" #"n1-standard-1"
  can_ip_forward       = true

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  # Create a new boot disk from an image
  disk {
    source_image = "${var.fortigate_image}"
    auto_delete  = true
    boot         = true
  }
  # Logging Disk
  disk {
    auto_delete = true
    boot        = false
    disk_size_gb = 30
  }
# Public facing managment port with public IP.
  network_interface {
    subnetwork = "${google_compute_subnetwork.public_managment_subnet.self_link}"
    access_config {
      nat_ip = ""
    }
  }
   # Protected instances port
      network_interface {
     subnetwork = "${google_compute_subnetwork.protected_subnet.self_link}"
   }
  # Callback url and ssh key
  metadata = {
    user-data : "{'config-url':'${google_cloudfunctions_function.function.https_trigger_url}'}"
  }
  # Email will be the service account used to call Cloud Functions
  service_account {
    email = "${var.service_account}"
    scopes = []
  }
}
resource "google_compute_health_check" "autohealing" {
   name                = "${var.cluster_name}-healthcheck-${random_string.random_name_post.result}"
   check_interval_sec  = 5
   timeout_sec         = 5
   healthy_threshold   = 2
   unhealthy_threshold = 10 # 50 seconds

   https_health_check {
     port         = "8443"
   }
 }



resource "google_compute_region_instance_group_manager" "appserver" {
  name = "${var.cluster_name}-fortigate-autoscale-${random_string.random_name_post.result}"
  base_instance_name        = "${var.cluster_name}-instance-${random_string.random_name_post.result}"
  region                    = "${var.region}"
  distribution_policy_zones = "${data.google_compute_zones.get_zones.names}"

  target_pools = ["${google_compute_target_pool.default.self_link}"]
  target_size  = 2

     auto_healing_policies {
     health_check      = google_compute_health_check.autohealing.self_link
     initial_delay_sec = 500
   }
  version {
    name = "Default"
   instance_template         = "${google_compute_instance_template.default.self_link}"
   }

}
### Regional AutoScaler ###
resource "google_compute_region_autoscaler" "default" {
  provider = "google-beta"
  project  = "${var.project}"
  #Name needs to be in lowercase
  name   = "${var.cluster_name}-autoscaler-${random_string.random_name_post.result}"
  region = "${var.region}"
  target = "${google_compute_region_instance_group_manager.appserver.self_link}"

  autoscaling_policy {
    max_replicas    = "${var.max_replicas}"
    min_replicas    = "${var.min_replicas}"
    cooldown_period = "${var.cooldown_period}"

    cpu_utilization {
      target = "${var.cpu_utilization}"
    }
  }
}

# No Capital Letters allowed in the bucket name
resource "google_storage_bucket" "bucket" {

  name = "fortigate-autoscale-${random_string.random_name_post.result}"
}

resource "google_storage_bucket_object" "archive" {
  name   = "${var.source_code_name}"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "${var.source_code_location}"
}
# Use rendered template file and upload as 'baseconfig'
resource "google_storage_bucket_object" "baseconfig" {
  name   = "baseconfig"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "./assets/configset/baseconfig.rendered"
  depends_on = ["data.template_file.setup_secondary_ip"]
}
data "google_iam_policy" "editor" {
  binding {
    role = "roles/editor"
    members = [
      "serviceAccount:${var.service_account}",

    ]
  }
}

resource "google_cloudfunctions_function_iam_member" "invoker" {
  project = "${var.project}"
  region = "${var.region}"
  cloud_function = "${google_cloudfunctions_function.function.name}"
  role   = "roles/cloudfunctions.invoker"
  # use AllUsers since config-url does not support IAM.
  member = "allUsers"
}


resource "google_cloudfunctions_function" "function" {
  #If name is updated the Trigger URL will need to be updated too.
  name        = "${var.cluster_name}-${random_string.random_name_post.result}"
  description = "FortiGate AutoScaling Function"
  runtime     = "${var.nodejs_version}"
  ingress_settings = "ALLOW_INTERNAL_ONLY"
  available_memory_mb   = 1024
  source_archive_bucket = "${google_storage_bucket.bucket.name}"
  source_archive_object = "${google_storage_bucket_object.archive.name}"
  trigger_http          = true
  timeout               = "${var.SCRIPT_TIMEOUT}"
  entry_point           = "main"

  environment_variables = {
      PROJECT_ID                 = "${var.project}" #Used by Bucket
      REGION                     = "${var.region}"
      FIRESTORE_DATABASE         = "${var.cluster_name}-fortigateautoscale-${random_string.random_name_post.result}",
      ASSET_STORAGE_NAME         = "${google_storage_bucket.bucket.name}",
      ASSET_STORAGE_KEY_PREFIX   = "empty",
      FORTIGATE_PSK_SECRET       = "${random_string.psk.result}",
      FIRESTORE_INITIALIZED      = "false",
      TRIGGER_URL                = "https://${var.region}-${var.project}.cloudfunctions.net/${var.cluster_name}-${random_string.random_name_post.result}"
      RESOURCE_TAG_PREFIX        = "${var.cluster_name}"
      PAYG_SCALING_GROUP_NAME    = "${var.cluster_name}-${random_string.random_name_post.result}",
      BYOL_SCALING_GROUP_NAME    = "${var.cluster_name}-${random_string.random_name_post.result}",
      #TODO: change value toMAIN once core logic is changed.
      MASTER_SCALING_GROUP_NAME  = "${var.cluster_name}-${random_string.random_name_post.result}",
      HEART_BEAT_LOSS_COUNT      = "${var.HEART_BEAT_LOSS_COUNT}",
      SCRIPT_TIMEOUT             = "${var.SCRIPT_TIMEOUT}"
       #TODO: change value toMAIN once core logic is changed.
      MASTER_ELECTION_TIMEOUT    = "${var.PRIMARY_ELECTION_TIMEOUT}",
      REQUIRED_CONFIG_SET        = "empty",
      UNIQUE_ID                  = "empty",
      CUSTOM_ID                  = "empty",
      AUTOSCALE_HANDLER_URL      = "https://${var.region}-${var.project}.cloudfunctions.net/${var.cluster_name}-${random_string.random_name_post.result}",
      DEPLOYMENT_SETTINGS_SAVED  = "true",
      ENABLE_FORTIGATE_ELB       = "false",
      ENABLE_DYNAMIC_NAT_GATEWAY = "false",
      ENABLE_HYBRID_LICENSING    = "false",
      ENABLE_INTERNAL_ELB        = "false",
      ENABLE_SECOND_NIC          = "false",
      ENABLE_VM_INFO_CACHE       = "false",
      FORTIGATE_ADMIN_PORT       = "${var.FORTIGATE_ADMIN_PORT}",
      FORTIGATE_SYNC_INTERFACE   = "port1",
       #TODO: change value toMAIN once core logic is changed.
      MASTER_ELECTION_NO_WAIT    = "true",
      HEARTBEAT_INTERVAL         = "${var.HEARTBEAT_INTERVAL}",
      HEART_BEAT_DELAY_ALLOWANCE = "${var.HEART_BEAT_DELAY_ALLOWANCE}",
      FORTIGATE_AUTOSCALE_VPC_ID = "empty",
      ELASTIC_IP_NAME            = google_compute_address.static.name

  }
}

### External Load Balancer ###
data "template_file" "setup_secondary_ip" {
  template = "${file("${path.module}/assets/configset/baseconfig")}"
  vars = {
    fgt_secondary_ip         = "${google_compute_forwarding_rule.default.ip_address}",
    fgt_internalslb_ip       = "${google_compute_forwarding_rule.internal_load_balancer.ip_address}",
  }
}
resource "local_file" "setup_secondary_ip_render" {
  content  = "${data.template_file.setup_secondary_ip.rendered}"
  filename = "${path.module}/assets/configset/baseconfig.rendered"
}
resource "google_compute_forwarding_rule" "default" {
  name   = "${var.cluster_name}-loadbalancer-rule-${random_string.random_name_post.result}"
  region = "${var.region}"

  load_balancing_scheme = "EXTERNAL"
  target     = "${google_compute_target_pool.default.self_link}"
}

resource "google_compute_http_health_check" "default" {
  name               = "${var.cluster_name}-check-backend-${random_string.random_name_post.result}"
  check_interval_sec = 3
  timeout_sec        = 2
  unhealthy_threshold = 3
  port = "8008"
}


### Target Pools ###
resource "google_compute_target_pool" "default" {
  name = "${var.cluster_name}-instancepool-${random_string.random_name_post.result}"
  session_affinity = "CLIENT_IP"

   health_checks = [
     "${google_compute_http_health_check.default.name}",
   ]
}

### Internal Load Balancer ###

resource "google_compute_forwarding_rule" "internal_load_balancer" {
  name   = "${var.cluster_name}-internal-slb-${random_string.random_name_post.result}"
  region = "${var.region}"

  load_balancing_scheme = "INTERNAL"
  backend_service       = "${google_compute_region_backend_service.internal_load_balancer_backend.self_link}"
  all_ports             = true
  network               = "${google_compute_network.protected_vpc_network.self_link}"
  subnetwork            = "${google_compute_subnetwork.protected_subnet.self_link}"
}
resource "google_compute_address" "master_external_address" {
  name = "${var.cluster_name}-external-address-${random_string.random_name_post.result}"
}

resource "google_compute_region_backend_service" "internal_load_balancer_backend" {
  name          = "${var.cluster_name}-internal-slb-backend-${random_string.random_name_post.result}"
  region        = "${var.region}"
  health_checks = [google_compute_health_check.hc.self_link]
}

resource "google_compute_health_check" "hc" {
  name               = "${var.cluster_name}-internal-slb-healthcheck-${random_string.random_name_post.result}"
  check_interval_sec = 3
  timeout_sec        = 2
  tcp_health_check {
    port = "80"
  }
}

output "InstanceTemplate" {
  value = "${google_compute_instance_template.default.name}"
}

output "google_compute_region_instance_group_manager" {
  value = "${google_compute_region_instance_group_manager.appserver.name}"
}

output "Trigger_URL" {
  value = "${google_cloudfunctions_function.function.https_trigger_url}"
}
 output "LoadBalancer_Ip_Address" {
   value = "${google_compute_forwarding_rule.default.ip_address}"
 }
output "Note" {
  value = "The FireStore Database must be deleted separately"
}
output "Master_Static_Address" {
  value = "${google_compute_address.static.address}"
}
output "Primary_static_address_name" {
  value = "${google_compute_address.static.name}"
}