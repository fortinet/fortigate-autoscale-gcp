### VPC ###
resource "google_compute_network" "vpc_network" {
  name                    = "${var.cluster_name}-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "public_subnet" {
  name          = "${var.cluster_name}-public-subnet-${random_string.random_name_post.result}"
  region        = var.region
  network       = google_compute_network.vpc_network.self_link
  ip_cidr_range = var.public_subnet
}
resource "google_compute_address" "static" {
  name = "${var.cluster_name}-static-ip-${random_string.random_name_post.result}"
}
### Public VPC Firewall Policy ###
#Default direction is ingress
resource "google_compute_firewall" "firewall" {
  name     = "${var.cluster_name}-firewall-${random_string.random_name_post.result}"
  network  = google_compute_network.vpc_network.name
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
  region        = var.region
  network       = google_compute_network.public_managment_vpc_network.self_link
  ip_cidr_range = var.public_managment_subnet
}
### Public managment VPC Firewall Policy ###
resource "google_compute_firewall" "public_managment_firewall" {
  name     = "${var.cluster_name}-firewall-public-managment-${random_string.random_name_post.result}"
  network  = google_compute_network.public_managment_vpc_network.name
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
  region        = var.region
  network       = google_compute_network.protected_vpc_network.self_link
  ip_cidr_range = var.protected_subnet

}
### Protected VPC Firewall Policy ###
#Default direction is ingress
resource "google_compute_firewall" "protected_firewall" {
  name     = "${var.cluster_name}-protected-vpc-firewall-${random_string.random_name_post.result}"
  network  = google_compute_network.protected_vpc_network.name
  priority = "100"
  allow {
    protocol = "all"
  }

  source_ranges = ["${var.protected_firewall_allowed_range}"]
}

### SYNC vpc ###
resource "google_compute_network" "sync_vpc" {
  name                    = "${var.cluster_name}-sync-vpc-${random_string.random_name_post.result}"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "sync_subnet" {
  name          = "${var.cluster_name}-sync-subnet-${random_string.random_name_post.result}"
  region        = var.region
  network       = google_compute_network.sync_vpc.self_link
  ip_cidr_range = var.sync_subnet

}
### sync vpc policy ###
resource "google_compute_firewall" "sync_firewall" {
  name     = "${var.cluster_name}-sync-vpc-firewall-${random_string.random_name_post.result}"
  network  = google_compute_network.sync_vpc.name
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
  router                             = google_compute_router.protected_subnet_router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

}
resource "google_compute_router" "protected_subnet_router" {
  name    = "${var.cluster_name}-router-${random_string.random_name_post.result}"
  region  = var.region
  network = google_compute_network.protected_vpc_network.self_link
}
resource "google_compute_forwarding_rule" "default" {
  name   = "${var.cluster_name}-loadbalancer-rule-${random_string.random_name_post.result}"
  region = var.region

  load_balancing_scheme = "EXTERNAL"
  target                = google_compute_target_pool.default.self_link
}

resource "google_compute_http_health_check" "default" {
  name                = "${var.cluster_name}-check-backend-${random_string.random_name_post.result}"
  check_interval_sec  = 3
  timeout_sec         = 2
  unhealthy_threshold = 3
  port                = "8008"
}


### Target Pools ###
resource "google_compute_target_pool" "default" {
  name             = "${var.cluster_name}-instancepool-${random_string.random_name_post.result}"
  session_affinity = "CLIENT_IP"

  health_checks = [
    "${google_compute_http_health_check.default.name}",
  ]
}

### Internal Load Balancer ###

resource "google_compute_forwarding_rule" "internal_load_balancer" {
  name   = "${var.cluster_name}-internal-slb-${random_string.random_name_post.result}"
  region = var.region

  load_balancing_scheme = "INTERNAL"
  backend_service       = google_compute_region_backend_service.internal_load_balancer_backend.self_link
  all_ports             = true
  network               = google_compute_network.protected_vpc_network.self_link
  subnetwork            = google_compute_subnetwork.protected_subnet.self_link
}
resource "google_compute_address" "master_external_address" {
  name = "${var.cluster_name}-external-address-${random_string.random_name_post.result}"
}

resource "google_compute_region_backend_service" "internal_load_balancer_backend" {
  name          = "${var.cluster_name}-internal-slb-backend-${random_string.random_name_post.result}"
  region        = var.region
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