terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30.0"
    }
  }
  backend "gcs" {
    bucket = "energytycoon-tfstate"
    prefix = "cloudrun"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  default_container_image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo_name}/${var.service_name}:${var.image_tag}"
  container_image         = var.image_url != "" ? var.image_url : local.default_container_image
  secret_ids              = { for s in var.secret_env_vars : s.secret => s if s.secret != "" }
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "secretmanager.googleapis.com"
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "backend_repo" {
  location      = var.region
  repository_id = var.repo_name
  description   = "Docker repository for backend service"
  format        = "DOCKER"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

resource "google_service_account" "run" {
  account_id   = var.run_service_account_id
  display_name = "Cloud Run execution for ${var.service_name}"
}

resource "google_project_iam_member" "run_sa_artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_sa_secret_access" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = each.key
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_cloud_run_v2_service" "backend" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = local.container_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        iterator = secret
        content {
          name = secret.value.name
          value_source {
            secret_key_ref {
              secret  = secret.value.secret
              version = secret.value.version
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.backend_repo,
    google_project_iam_member.run_sa_artifact_registry_reader,
    google_secret_manager_secret_iam_member.run_sa_secret_access
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}
