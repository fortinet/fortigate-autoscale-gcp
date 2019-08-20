provider "google" {
  credentials = "${file("account.json")}"
  project     = "${var.project}"
  region      = "us-central1"
  zone        = "us-central1-c"
}


resource "random_string" "psk" {
  length           = 16
  special          = true
  override_special = ""
}
//Random 3 char string appended to the ened of each name to avoid conflicts
resource "random_string" "random_name_post" {
  length           = 5
  special          = true
  override_special = ""
  min_lower        = 5
}

resource "google_compute_instance" "vm_instance" {
  name         = "jcripps-terraform-instance"
  machine_type = "f1-micro"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-9"
    }
  }

  network_interface {
    # A default network is created for all GCP projects
    network = "default"
    access_config {

    }
  }
}
resource "google_compute_network" "vpc_network" {
  name = "${var.cluster_name}-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "public_subnet" {
  name   = "${var.cluster_name}-public-subnet${random_string.random_name_post.result}"
  region = "${var.region}"
  network = "${google_compute_network.vpc_network.self_link}"
  ip_cidr_range = "${var.public_subnet}"
}
resource "google_compute_subnetwork" "private_subnet" {
  name   = "${var.cluster_name}-private-subnet${random_string.random_name_post.result}"
  region = "${var.region}"
  network = "${google_compute_network.vpc_network.self_link}"
  ip_cidr_range = "${var.protected_subnet}"
}


# Instance Template
resource "google_compute_instance_template" "default" {
  depends_on  = ["google_cloudfunctions_function.function"]
  name        = "jcripps-terraform-instance"
  description = "This template is used to create app server instances."

  labels = {
    environment = "dev"
  }

  instance_description = "description assigned to instances"
  machine_type         = "${var.instance}" //"n1-standard-1"
  can_ip_forward       = false

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  // Create a new boot disk from an image
  //https://console.cloud.google.com/marketplace/details/centos-cloud/centos-6?filter=category:os&q=CentOS&id=a12ddfd2-8e61-4968-96d4-22a189c527c5
  //https://console.cloud.google.com/marketplace/details/fortigcp-project-001/fortigate-payg?q=fortigate&id=68eae12e-f42e-452e-85bb-6939f3baa0f5
  //https://console.cloud.google.com/marketplace/details/debian-cloud/debian-stretch?q=debian&id=02d02f87-14ba-4160-8d5e-7276f9491d0c
  disk {
    //source_image = "fortigcp-project-001/fortigate/fortigate-payg"
    source_image = "projects/fortigcp-project-001/global/images/keithchoi-fgtondemand-621-20190723-001-w-license" //"fortigcp-project-001/fortigate/keithchoi-fgtondemand-621-20190723-001-w-license"
    auto_delete  = true
    boot         = true
  }

  // Use an existing disk resource
  disk {
    // Instance Templates reference disks by name, not self link
    auto_delete = false
    boot        = false
  }

  network_interface {
    subnetwork = "${google_compute_subnetwork.public_subnet.self_link}"
    access_config {
      nat_ip = ""
    }

  }
  metadata = {
    user-data : "{'config-url':'${google_cloudfunctions_function.function.https_trigger_url}'}"
  }

  service_account {
    scopes = ["userinfo-email", "compute-ro", "storage-ro"]
  }
}
resource "google_compute_health_check" "autohealing" {
  name                = "autohealing-health-check"
  check_interval_sec  = 5
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 10 # 50 seconds

  http_health_check {
    request_path = "/healthz"
    port         = "8443"
  }
}

resource "google_compute_region_instance_group_manager" "appserver" {
  name = "fortigate-autoscale-${random_string.random_name_post.result}"

  base_instance_name        = "app"
  instance_template         = "${google_compute_instance_template.default.self_link}"
  region                    = "us-central1"
  distribution_policy_zones = ["us-central1-a", "us-central1-b"]

  target_pools = ["${google_compute_target_pool.default.self_link}"]
  target_size  = 2

  named_port {
    name = "custom"
    port = 8888
  }

  auto_healing_policies {
    health_check      = "${google_compute_health_check.autohealing.self_link}"
    initial_delay_sec = 300
  }
}
### Regional AutoScaler ###
resource "google_compute_region_autoscaler" "default" {
  provider = "google-beta"
  project = "${var.project}"
  #Name needs to be in lowercase
  name   = "${var.cluster_name}-autoscaler-${random_string.random_name_post.result}"
  region = "${var.region}"
  target = "${google_compute_region_instance_group_manager.appserver.self_link}"

  autoscaling_policy {
    max_replicas    = 4
    min_replicas    = 2
    cooldown_period = 60

    cpu_utilization {
      target = 0.5
    }
  }
}

# No Capital Letters allowed in the bucket name
resource "google_storage_bucket" "bucket" {
  name = "foritgate-autoscale-${random_string.random_name_post.result}"
}

resource "google_storage_bucket_object" "archive" {
  name   = "gcp.zip"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "./dist/gcp.zip"
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
  runtime     = "nodejs10" //TODO: add as var

  available_memory_mb   = 256
  source_archive_bucket = "${google_storage_bucket.bucket.name}"
  source_archive_object = "${google_storage_bucket_object.archive.name}"
  trigger_http          = true
  timeout               = 500
  entry_point           = "main"
  labels = {
    my-label = "my-label-value"
  }

  environment_variables = {
    PROJECT_ID            = "${var.project}" #Used by Bucket
    FIRESTORE_DATABASE    = "${var.cluster_name}-${random_string.random_name_post.result}",
    ASSET_STORAGE_NAME    = "${google_storage_bucket.bucket.name}",
    FORTIGATE_PSK_SECRET  = "${random_string.psk.result}",
    FIRESTORE_INITIALIZED = "false",
    TRIGGER_URL           = "https://${var.region}-${var.project}.cloudfunctions.net/${var.cluster_name}-${random_string.random_name_post.result}"
  }
}

#### Load Balancer ####
resource "google_compute_global_forwarding_rule" "default" {
  name       = "global-rule"
  target     = "${google_compute_target_http_proxy.default.self_link}"
  port_range = "80"
}

resource "google_compute_target_http_proxy" "default" {
  name        = "target-proxy"
  description = "a description"
  url_map     = "${google_compute_url_map.default.self_link}"
}

resource "google_compute_url_map" "default" {
  name            = "url-map-target-proxy"
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
  name        = "backend"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 10

  health_checks = ["${google_compute_http_health_check.default.self_link}"]
}

resource "google_compute_http_health_check" "default" {
  name               = "check-backend"
  request_path       = "/"
  check_interval_sec = 1
  timeout_sec        = 1
}


### Target Pools ###
resource "google_compute_target_pool" "default" {
  name = "instance-pool"

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
output "Ip_Address" {
  value = "${google_compute_global_forwarding_rule.default.ip_address}"
}
output "LoadBalance_instances" {
  value = "${google_compute_target_pool.default.instances}"
}
