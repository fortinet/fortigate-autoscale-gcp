output "InstanceTemplate" {
  value = google_compute_instance_template.default.name
}
output "google_compute_region_instance_group_manager" {
  value = google_compute_region_instance_group_manager.appserver.name
}

output "Trigger_URL" {
  value = google_cloudfunctions_function.function.https_trigger_url
}
output "LoadBalancer_Ip_Address" {
  value = google_compute_forwarding_rule.default.ip_address
}
output "Note" {
  value = "The FireStore Database must be deleted separately"
}
output "Primary_Static_Address" {
  value = google_compute_address.static.address
}
output "Primary_static_address_name" {
  value = google_compute_address.static.name
}
