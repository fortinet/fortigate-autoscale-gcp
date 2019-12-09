joel
terraform {
  required_providers {
    google = "2.11.0"
    google-beta = "2.13"
  }
}
provider "google" {
  credentials = "${file("${var.auth_key}")}"
  project     = "${var.project}"
  region      = "${var.region}"
  zone        = "${var.zone}"
}
provider "google-beta" {
  credentials = "${file("${var.auth_key}")}"
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

 resource "google_compute_subnetwork" "private_subnet" {
   name          = "${var.cluster_name}-private-subnet-${random_string.random_name_post.result}"
   region        = "${var.region}"
   network       = "${google_compute_network.vpc_network.self_link}"
   ip_cidr_range = "${var.protected_subnet}"
 }
### Firewall Policy ###
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



# Instance Template
resource "google_compute_instance_template" "default" {
  depends_on  = ["google_cloudfunctions_function.function"]
  name        = "${var.cluster_name}-instance-template-${random_string.random_name_post.result}"
  description = "This template is used to create app server instances."

  instance_description = "description assigned to instances"
  machine_type         = "${var.instance}" #"n1-standard-1"
  can_ip_forward       = false

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }
  # https://www.googleapis.com/compute/v1/projects/fortigcp-project-001/global/images/fortinet-fgtondemand-622-20191010-001-w-license
  # Create a new boot disk from an image
  disk {
    source_image = "${var.fortigate_image}" //"projects/fortigcp-project-001/global/images/keithchoi-fgtondemand-621-20190723-001-w-license"    #Default 6.2.1 PAYG
    auto_delete  = true
    boot         = true
  }
  # Logging Disk
  disk {
    # Instance Templates reference disks by name, not self link
    auto_delete = true
    boot        = false
  }

  network_interface {
    subnetwork = "${google_compute_subnetwork.public_subnet.self_link}"
    access_config {
      nat_ip = ""
    }

  }
  # Callback url and ssh key
  metadata = {
    user-data : "{'config-url':'${google_cloudfunctions_function.function.https_trigger_url}'}"
    ssh-keys="admin:${file(var.public_key_path)}"
  }
  service_account {
    scopes = ["userinfo-email", "compute-ro", "storage-ro"]
  }
}
resource "google_compute_health_check" "autohealing" {
  provider = "google-beta"
  name                = "${var.cluster_name}-healthcheck-${random_string.random_name_post.result}"
  check_interval_sec  = 5
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 10 # 50 seconds

  http_health_check {
    request_path = "/"
    port         = "8443"
  }
}

resource "google_compute_region_instance_group_manager" "appserver" {

  name = "${var.cluster_name}-fortigate-autoscale-${random_string.random_name_post.result}"

  base_instance_name        = "${var.cluster_name}-instance-${random_string.random_name_post.result}"
  instance_template         = "${google_compute_instance_template.default.self_link}"
  region                    = "us-central1"
  distribution_policy_zones = ["us-central1-a", "us-central1-b"]

  target_pools = ["${google_compute_target_pool.default.self_link}"]
  target_size  = 2

  named_port {
    name = "custom"
    port = 8888
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
  name = "foritgate-autoscale-${random_string.random_name_post.result}"
}

resource "google_storage_bucket_object" "archive" {
  name   = "${var.source_code_name}"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "${var.source_code}"
}
resource "google_storage_bucket_object" "baseconfig" {
  name   = "baseconfig"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "./assets/configset/baseconfig"
}
resource "google_cloudfunctions_function" "function" {
  #If name is updated the Trigger URL will need to be updated too.
  name        = "${var.cluster_name}-${random_string.random_name_post.result}"
  description = "My function"
  runtime     = "${var.nodejs_version}"

  available_memory_mb   = 1024
  source_archive_bucket = "${google_storage_bucket.bucket.name}"
  source_archive_object = "${google_storage_bucket_object.archive.name}"
  trigger_http          = true
  timeout               = "${var.SCRIPT_TIMEOUT}"
  entry_point           = "main"

  environment_variables = {
    PROJECT_ID                 = "${var.project}" #Used by Bucket
    FIRESTORE_DATABASE         = "${var.cluster_name}-fortigateautoscale-${random_string.random_name_post.result}",
    ASSET_STORAGE_NAME         = "${google_storage_bucket.bucket.name}",
    ASSET_STORAGE_KEY_PREFIX   = "empty",
    FORTIGATE_PSK_SECRET       = "${random_string.psk.result}",
    FIRESTORE_INITIALIZED      = "false",
    TRIGGER_URL                = "https://${var.region}-${var.project}.cloudfunctions.net/${var.cluster_name}-${random_string.random_name_post.result}"
    RESOURCE_TAG_PREFIX        = "${var.cluster_name}"
    PAYG_SCALING_GROUP_NAME    = "${var.cluster_name}-${random_string.random_name_post.result}",
    BYOL_SCALING_GROUP_NAME    = "${var.cluster_name}-${random_string.random_name_post.result}",
    MASTER_SCALING_GROUP_NAME  = "${var.cluster_name}-${random_string.random_name_post.result}",
    HEART_BEAT_LOSS_COUNT      = "${var.HEART_BEAT_LOSS_COUNT}",
    SCRIPT_TIMEOUT             = "${var.SCRIPT_TIMEOUT}"
    MASTER_ELECTION_TIMEOUT    = "${MASTER_ELECTION_TIMEOUT}",
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
    MASTER_ELECTION_NO_WAIT    = "true",
    HEARTBEAT_INTERVAL         = "${var.HEARTBEAT_INTERVAL}",
    HEART_BEAT_DELAY_ALLOWANCE = "${var.HEART_BEAT_DELAY_ALLOWANCE}"
  }
}

#### Load Balancer ####
resource "google_compute_global_forwarding_rule" "default" {
  name       = "${var.cluster_name}-global-rule-${random_string.random_name_post.result}"
  target     = "${google_compute_target_http_proxy.default.self_link}"
  port_range = "80"
}

resource "google_compute_target_http_proxy" "default" {
  name        = "${var.cluster_name}-target-proxy-${random_string.random_name_post.result}"
  description = "a description"
  url_map     = "${google_compute_url_map.default.self_link}"
}

resource "google_compute_url_map" "default" {
  name            = "${var.cluster_name}-url-map-target-proxy-${random_string.random_name_post.result}"
  description     = ""
  default_service = "${google_compute_backend_service.default.self_link}"

  host_rule {
    hosts        = ["mysite.com"]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = "${google_compute_backend_service.default.self_link}"

    path_rule {
      paths   = ["/*"]
      service = "${google_compute_backend_service.default.self_link}"
    }
  }
}

resource "google_compute_backend_service" "default" {
  name        = "${var.cluster_name}-backend-${random_string.random_name_post.result}"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 10

  health_checks = ["${google_compute_http_health_check.default.self_link}"]
}

resource "google_compute_http_health_check" "default" {
  name               = "${var.cluster_name}-check-backend-${random_string.random_name_post.result}"
  request_path       = "/"
  check_interval_sec = 1
  timeout_sec        = 1
}


### Target Pools ###
resource "google_compute_target_pool" "default" {
  name = "${var.cluster_name}-instancepool-${random_string.random_name_post.result}"

  instances = [

  ]

  health_checks = [
    "${google_compute_http_health_check.default.name}",
  ]
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
  value = "${google_compute_global_forwarding_rule.default.ip_address}"
}
output "Notes" {
  value = "The FireStore Database must be deleted seperately"
}
