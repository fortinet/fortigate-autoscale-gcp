variable "project" {
  type    = string
  default = ""
}
variable "service_account" {
  type    = string
  default = ""
}
variable "region" {
  type    = string
  default = "us-central1" #Default Region
}
variable "zone" {
  type    = string
  default = "us-central1-c"
}

variable "auth_key" {
  type    = string
  default = "account.json"
}
# Zones to use with Instance Group
data "google_compute_zones" "get_zones" {
}
# FortiGate Image
variable "fortigate_image" {
  type    = string
  default = "projects/fortigcp-project-001/global/images/fortinet-fgtondemand-720-20220622-001-w-license" #Default 7.2.0 PAYG Image
}
#Default
variable "instance" {
  type    = string
  default = "n1-standard-4"
}
#Must be lower-case for VPC
variable "cluster_name" {
  type    = string
  default = "fortigateautoscale"
}
#Must be all lower case
variable "bucket_name" {
  type    = string
  default = "fortigateautoscale"
}
# Nodejs Version
variable "nodejs_version" {
  type    = string
  default = "nodejs10"
}
#Source zip to be uploaded to Compute Function
variable "source_code_location" {
  type    = string
  default = "./dist/gcp.zip"
}
variable "source_code_name" {
  type    = string
  default = "gcp.zip"
}
# Upload a Local ssh key to the FortiGates
variable "public_key_path" {
  type    = string
  default = ""
}

#### Network Settings ####
variable "vpc_cidr" {
  type    = string
  default = "172.16.0.0/16"
}
variable "public_subnet" {
  type    = string
  default = "172.16.0.0/24"
}
variable "protected_subnet" {
  type    = string
  default = "172.16.8.0/24"
}
variable "public_managment_subnet" {
  type    = string
  default = "172.16.16.0/24"
}
variable "sync_subnet" {
  type    = string
  default = "172.16.24.0/24"
}
variable "firewall_allowed_range" {
  type    = string
  default = "0.0.0.0/0"
}

# Internal Protected VPC
variable "protected_firewall_allowed_range" {
  type    = string
  default = "0.0.0.0/0"
}
####  AutoScaling Configuration #####
variable "max_replicas" {
  type    = number
  default = 4
}
variable "min_replicas" {
  type    = number
  default = 2
}
variable "cooldown_period" {
  type    = number
  default = 60
}
variable "cpu_utilization" {
  type    = number
  default = 0.5 #Aggregated
}
# Number of instances to aim for
variable "target_size" {
  type    = number
  default = 2
}
#### Optional Configurations ####
#Cloud Function timeout. In seconds
variable "SCRIPT_TIMEOUT" {
  type    = number
  default = 500
}
# Time before a PRIMARY times out. In seconds
variable "PRIMARY_ELECTION_TIMEOUT" {
  type    = number
  default = 400
}
# Admin port for the fortigate
variable "FORTIGATE_ADMIN_PORT" {
  type    = number
  default = 8443
}
# Seconds between sending heartbeat from fortigate
variable "HEARTBEAT_INTERVAL" {
  type    = number
  default = 25
}
# Seconds of allowed variance in heartbeats
variable "HEART_BEAT_DELAY_ALLOWANCE" {
  type    = number
  default = 10
}
# Allowed delay between heartbeats before a heartbeat loss is counted
variable "HEART_BEAT_LOSS_COUNT" {
  type    = number
  default = 10
}
