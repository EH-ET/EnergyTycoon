output "artifact_registry_repo" {
  description = "Artifact Registry docker repo path."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo_name}"
}

output "container_image" {
  description = "Full image path used by the Cloud Run service."
  value       = local.container_image
}

output "cloud_run_url" {
  description = "Deployed Cloud Run URL."
  value       = google_cloud_run_v2_service.backend.uri
}

output "cloud_run_service_account" {
  description = "Service account used by the Cloud Run service."
  value       = google_service_account.run.email
}
