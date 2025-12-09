variable "project_id" {
  description = "The GCP project ID to deploy to."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources in (e.g., asia-east1)."
  type        = string
  default     = "asia-east1"
}

variable "service_name" {
  description = "The name for the Cloud Run service and Docker image."
  type        = string
  default     = "energy-tycoon-backend"
}

variable "repo_name" {
  description = "The name for the Artifact Registry repository."
  type        = string
  default     = "energy-tycoon-backend-repo"
}

variable "run_service_account_id" {
  description = "Service account id (without domain) for running the Cloud Run service."
  type        = string
  default     = "energy-tycoon-runner"
}

variable "container_port" {
  description = "The port your backend application listens on inside the container."
  type        = number
  default     = 8080
}

variable "min_instances" {
  description = "Minimum number of container instances for Cloud Run."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of container instances for Cloud Run."
  type        = number
  default     = 10
}

variable "cpu_limit" {
  description = "CPU limit for the Cloud Run service (e.g., '1' for 1 CPU)."
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit for the Cloud Run service (e.g., '512Mi' or '1Gi')."
  type        = string
  default     = "512Mi"
}

variable "image_tag" {
  description = "Tag to apply to the container image stored in Artifact Registry (e.g., v1.0.0)."
  type        = string
  default     = "latest"
}

variable "image_url" {
  description = "Full image URI to deploy (overrides repo/name/tag composition when set)."
  type        = string
  default     = ""
}

variable "env_vars" {
  description = "Plain environment variables for the Cloud Run service."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret Manager backed environment variables for the Cloud Run service."
  type = list(object({
    name    = string
    secret  = string
    version = string
  }))
  default = []
}
