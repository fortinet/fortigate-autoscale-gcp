
# Instance Template
resource "google_compute_instance_template" "default" {
  depends_on  = [google_cloudfunctions_function.function]
  name        = "${var.cluster_name}-instance-template-${random_string.random_name_post.result}"
  description = "Fortigate AutoScale Cluster"

  instance_description = "FortiGate AutoScale Cluster"
  machine_type         = var.instance #"n1-standard-1"
  can_ip_forward       = true

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  # Create a new boot disk from an image
  disk {
    source_image = var.fortigate_image
    auto_delete  = true
    boot         = true
  }
  # Logging Disk
  disk {
    auto_delete  = true
    boot         = false
    disk_size_gb = 30
  }
  # Public facing managment port with public IP.
  network_interface {
    subnetwork = google_compute_subnetwork.public_managment_subnet.self_link
    access_config {
      nat_ip = ""
    }
  }
  # Protected instances port
  network_interface {
    subnetwork = google_compute_subnetwork.protected_subnet.self_link
  }
  # Port3 Sync interface.
  network_interface {
    subnetwork = google_compute_subnetwork.sync_subnet.self_link
  }
  # Callback url and ssh key
  metadata = {
    user-data : "{'config-url':'${google_cloudfunctions_function.function.https_trigger_url}'}"
  }
  # Email will be the service account used to call Cloud Functions
  service_account {
    email  = var.service_account
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
    request_path = "/login?redir=%2Fng%2F"
  }
}

resource "google_compute_region_instance_group_manager" "appserver" {
  name                      = "${var.cluster_name}-fortigate-autoscale-${random_string.random_name_post.result}"
  base_instance_name        = "${var.cluster_name}-instance-${random_string.random_name_post.result}"
  region                    = var.region
  distribution_policy_zones = data.google_compute_zones.get_zones.names

  target_pools = ["${google_compute_target_pool.default.self_link}"]
  target_size  = 2

  auto_healing_policies {
    health_check      = google_compute_health_check.autohealing.self_link
    initial_delay_sec = 500
  }
  version {
    name              = "Default"
    instance_template = google_compute_instance_template.default.self_link
  }

}
### Regional AutoScaler ###
resource "google_compute_region_autoscaler" "default" {
  provider = google-beta
  project  = var.project
  #Name needs to be in lowercase
  name   = "${var.cluster_name}-autoscaler-${random_string.random_name_post.result}"
  region = var.region
  target = google_compute_region_instance_group_manager.appserver.self_link

  autoscaling_policy {
    max_replicas    = var.max_replicas
    min_replicas    = var.min_replicas
    cooldown_period = var.cooldown_period

    cpu_utilization {
      target = var.cpu_utilization
    }
  }
}


