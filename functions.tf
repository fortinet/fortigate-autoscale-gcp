resource "google_cloudfunctions_function_iam_member" "invoker" {
  project        = var.project
  region         = var.region
  cloud_function = google_cloudfunctions_function.function.name
  role           = "roles/cloudfunctions.invoker"
  # use AllUsers since config-url does not support IAM.
  member = "allUsers"
}


resource "google_cloudfunctions_function" "function" {
  #If name is updated the Trigger URL will need to be updated too.
  name                  = "${var.cluster_name}-${random_string.random_name_post.result}"
  description           = "FortiGate AutoScaling Function"
  runtime               = var.nodejs_version
  ingress_settings      = "ALLOW_INTERNAL_ONLY"
  available_memory_mb   = 1024
  source_archive_bucket = google_storage_bucket.bucket.name
  source_archive_object = google_storage_bucket_object.archive.name
  trigger_http          = true
  timeout               = var.SCRIPT_TIMEOUT
  entry_point           = "main"
  timeouts {
    create = "20m"
  }

  environment_variables = {
    PROJECT_ID               = "${var.project}" #Used by Bucket
    REGION                   = "${var.region}"
    FIRESTORE_DATABASE       = "${var.cluster_name}-fortigateautoscale-${random_string.random_name_post.result}",
    ASSET_STORAGE_NAME       = "${google_storage_bucket.bucket.name}",
    ASSET_STORAGE_KEY_PREFIX = "empty",
    FORTIGATE_PSK_SECRET     = "${random_string.psk.result}",
    FIRESTORE_INITIALIZED    = "false",
    TRIGGER_URL              = "https://${var.region}-${var.project}.cloudfunctions.net/${var.cluster_name}-${random_string.random_name_post.result}"
    RESOURCE_TAG_PREFIX      = "${var.cluster_name}"
    PAYG_SCALING_GROUP_NAME  = "${var.cluster_name}-${random_string.random_name_post.result}",
    BYOL_SCALING_GROUP_NAME  = "${var.cluster_name}-${random_string.random_name_post.result}",
    #TODO: change value to PRIMARY once core logic is changed.
    MASTER_SCALING_GROUP_NAME = "${var.cluster_name}-${random_string.random_name_post.result}",
    HEART_BEAT_LOSS_COUNT     = "${var.HEART_BEAT_LOSS_COUNT}",
    SCRIPT_TIMEOUT            = "${var.SCRIPT_TIMEOUT}"
    #TODO: change value to PRIMARY once core logic is changed.
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
    FORTIGATE_SYNC_INTERFACE   = "port3",
    #TODO: change value to PRIMARY once core logic is changed.
    MASTER_ELECTION_NO_WAIT    = "true",
    HEARTBEAT_INTERVAL         = "${var.HEARTBEAT_INTERVAL}",
    HEART_BEAT_DELAY_ALLOWANCE = "${var.HEART_BEAT_DELAY_ALLOWANCE}",
    FORTIGATE_AUTOSCALE_VPC_ID = "empty",
    ELASTIC_IP_NAME            = google_compute_address.static.name,

  }
}
data "template_file" "setup_secondary_ip" {
  template = file("${path.module}/assets/configset/baseconfig")
  vars = {
    fgt_secondary_ip   = "${google_compute_forwarding_rule.default.ip_address}",
    fgt_internalslb_ip = "${google_compute_forwarding_rule.internal_load_balancer.ip_address}",
  }
}
resource "local_file" "setup_secondary_ip_render" {
  content    = data.template_file.setup_secondary_ip.rendered
  filename   = "${path.module}/assets/configset/baseconfig.rendered"
  depends_on = [data.template_file.setup_secondary_ip]
}


