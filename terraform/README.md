# Google Cloud Run Backend Deployment

Terraform here provisions the pieces required to run the backend on Cloud Run:
* Enables core APIs (Run, Artifact Registry, Cloud Build).
* Creates a regional Artifact Registry Docker repo.
* Creates a dedicated Cloud Run service account with Artifact Registry pull access.
* Manages the Cloud Run v2 service (scaling, resources, env vars, public access).

The Docker image build and push still happen via the `gcloud` CLI so we can keep the Terraform state focused on infra.

## Prerequisites

1) Google Cloud project (billing enabled).
2) Google Cloud CLI installed and authenticated:
```bash
gcloud auth login
gcloud auth application-default login   # needed for Terraform auth if using ADC
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region YOUR_REGION   # e.g., asia-east1
```
3) Terraform installed.

## 1) Configure Terraform

From the repo root:
```bash
cd terraform
```

Create `terraform.tfvars` with your settings:
```hcl
project_id = "your-gcp-project-id"
region     = "asia-east1"
image_tag  = "v0.1.0" # tag you will push to Artifact Registry

# Optional overrides
# service_name            = "energy-tycoon-backend"
# repo_name               = "energy-tycoon-backend-repo"
# run_service_account_id  = "energy-tycoon-runner"
# container_port          = 8080
# min_instances           = 0
# max_instances           = 10
# cpu_limit               = "1"
# memory_limit            = "512Mi"

# Application env (non-secret)
# env_vars = {
#   DATABASE_URL     = "postgresql://..."
#   FRONTEND_ORIGINS = "https://your-frontend.app"
#   DEPLOY_FRONTEND_URL = "https://your-frontend.app"
# }

# Secret Manager backed env (avoids putting secrets in state)
# secret_env_vars = [
#   { name = "JWT_SECRET", secret = "jwt-secret", version = "latest" }
# ]
```

Then initialize and apply:
```bash
terraform init
terraform plan
terraform apply
```

Outputs will include the Artifact Registry repo path, full image URI, service URL, and the Cloud Run service account email.

## 2) Build and push the container image

From the repo root (Dockerfile lives here):
```bash
PROJECT_ID="your-gcp-project-id"
REGION="asia-east1"
REPO_NAME="energy-tycoon-backend-repo"
SERVICE_NAME="energy-tycoon-backend"
IMAGE_TAG="v0.1.0"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
gcloud builds submit --tag "${IMAGE}" .
```

## 3) Point Cloud Run at the new image

Terraform already knows the image URI shape. Apply with the tag you pushed:
```bash
cd terraform
terraform apply -var-file="terraform.tfvars" -var="image_tag=${IMAGE_TAG}"
```
Terraform will update the Cloud Run service to the new image.

## Redeploying later

1) Choose a new `IMAGE_TAG`.
2) Build and push with `gcloud builds submit --tag "${IMAGE}" .`.
3) `terraform apply -var-file="terraform.tfvars" -var="image_tag=${IMAGE_TAG}"`.

## Notes on secrets and env

* Anything in `env_vars` is stored in state; use only non-sensitive values.
* Use `secret_env_vars` for Secret Manager values; Terraform grants `secretAccessor` on those secrets to the Cloud Run service account (the secrets themselves must already exist).
* Default container port is 8080 to match the Dockerfile command (`PORT` is set automatically).

### Quick backend-only `terraform.tfvars` example (do NOT commit)

Create this file locally at `terraform/terraform.tfvars` (it is gitignored) to deploy only the backend with your env vars:
```hcl
project_id = "your-gcp-project-id"
region     = "asia-east1"
image_tag  = "v0.1.0"

env_vars = {
  ACCESS_COOKIE_NAME    = "ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88"
  ACCESS_TOKEN_TTL      = "3600"
  COOKIE_SAMESITE       = "Lax"
  COOKIE_SECURE         = "True"
  CSRF_COOKIE_NAME      = "csrf_token"
  DATABASE_URL          = "postgresql://neondb_owner:npg_Cvqe9YEj3QHc@ep-hidden-bar-a1sj71c9-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  DEPLOY_FRONTEND_URL   = "https://energytycoon.pages.dev"
  FRONTEND_ORIGINS      = "https://energytycoon.pages.dev"
  FRONTEND_ORIGIN_REGEX = "^https://.*\\.pages\\.dev$"
  IP_MAX_ATTEMPTS       = "100"
  IP_WINDOW_SECONDS     = "60"
  LOGIN_COOLDOWN_SECONDS= "0.1"
  PYTHON_VERSION        = "3.13.2"
  REFRESH_COOKIE_NAME   = "yeCuXMndsYC3kMnAPw__"
  REFRESH_TOKEN_TTL     = "604800"
  TRAP_COOKIE_NAME      = "abtkn"
}

# Strongly recommended: store secrets in Secret Manager instead of plaintext state
secret_env_vars = [
  { name = "JWT_SECRET",    secret = "jwt-secret",    version = "latest" },
  { name = "REFRESH_SECRET", secret = "refresh-secret", version = "latest" }
]
```

If the secrets do not exist yet, create them before `terraform apply`:
```bash
gcloud secrets create jwt-secret --replication-policy="automatic"
echo -n "your-jwt-secret" | gcloud secrets versions add jwt-secret --data-file=-
gcloud secrets create refresh-secret --replication-policy="automatic"
echo -n "your-refresh-secret" | gcloud secrets versions add refresh-secret --data-file=-
```
