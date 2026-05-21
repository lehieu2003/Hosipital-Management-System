# CI/CD and Deployment

This repository currently deploys with two tracks:

1. **Backend**: push to GitHub -> GitHub Actions runs backend tests -> builds Docker image -> pushes to GHCR -> SSH deploys to AWS EC2 -> EC2 pulls the new image and restarts the backend container
2. **Frontend**: GitHub Actions runs frontend test/build -> deploys production to Vercel

## Backend deployment assets

Backend deployment is driven by:

- `.github/workflows/backend-ci-cd.yml`
- `node-backend/Dockerfile`
- `deploy/aws/docker-compose.backend.yml`
- `deploy/aws/deploy-backend.sh`
- `deploy/aws/backend.env.example`

## Backend pipeline flow

On every push to `main` that touches backend or backend-deploy files:

1. Start PostgreSQL in GitHub Actions for test execution
2. Install backend dependencies
3. Generate Prisma client
4. Run backend tests
5. Build the backend
6. Build the Docker image from `node-backend/Dockerfile`
7. Push immutable `sha-<commit>` and `latest` tags to GHCR
8. SSH into the AWS EC2 host
9. Upload the compose file and deploy script
10. Upload the production backend env file
11. Pull the new image on EC2
12. Run `prisma migrate deploy`
13. Restart the backend container with the new image

## Frontend pipeline flow

On every push to `main` that touches frontend files:

1. Install frontend dependencies
2. Run frontend tests
3. Run frontend build
4. Pull Vercel project settings
5. Build Vercel output
6. Deploy production using Vercel CLI

## GitHub secrets

Add these in **GitHub -> Settings -> Secrets and variables -> Actions**.

### Backend secrets

- `GHCR_TOKEN`
  - Personal access token with at least:
    - `read:packages`
    - `write:packages`
  - Used both by GitHub Actions and by the EC2 host when pulling from GHCR
- `AWS_EC2_SSH_HOST`
  - Public IP or hostname of the EC2 instance
- `AWS_EC2_SSH_PORT`
  - Usually `22`
- `AWS_EC2_SSH_USER`
  - For Ubuntu AMIs this is often `ubuntu`
  - For Amazon Linux this is often `ec2-user`
- `AWS_EC2_SSH_PRIVATE_KEY`
  - Private key content used to SSH into the EC2 instance
- `BACKEND_ENV_FILE`
  - Full multiline content of the production backend env file
  - Start from `deploy/aws/backend.env.example`

Example `BACKEND_ENV_FILE` body:

```env
NODE_ENV=production
PORT=3000
BACKEND_PORT=3000
API_PREFIX=/api/v1
CORS_ORIGIN=https://your-frontend-project.vercel.app
JWT_ACCESS_SECRET=replace-with-long-random-secret
JWT_REFRESH_SECRET=replace-with-another-long-random-secret
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
DATABASE_URL=postgresql://postgres:postgres@your-postgres-host:5432/hms
```

### Frontend secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Also set the frontend runtime env in Vercel:

- `VITE_API_BASE_URL=https://your-backend-domain-or-ec2-host/api/v1`

## AWS EC2 bootstrap

Run these once on the EC2 host:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
mkdir -p ~/hms-backend
```

Log out and back in after adding the user to the `docker` group.

If your EC2 instance is not Ubuntu, install Docker using the matching distro instructions, then make sure the deploy user can run `docker compose` without `sudo`.

## Runtime notes

- Backend workflow pushes both `sha-<commit>` and `latest` tags to GHCR.
- Deployment uses the immutable `sha-<commit>` tag, not `latest`.
- `prisma migrate deploy` runs during backend deployment before the container is restarted.
- Backend deploy is health-gated. If the container starts but `/api/v1/healthz` does not respond, the deploy job fails and prints recent container logs.
- The deploy script expects `backend.env` and `docker-compose.backend.yml` inside `~/hms-backend` unless overridden.
- Swagger routes remain disabled in backend production because that behavior already exists in the app.

## Debugging production deploys

For the incident notes and repeatable debug flow used to fix the backend deployment, see [Backend Deployment Debug Report](docs/backend-deployment-debug-report.md).

## Manual verification after first setup

### Backend

```bash
curl http://<ec2-public-host>:3000/api/v1/healthz
```

Expected: HTTP `200` with the health payload.

### Frontend

Open the Vercel production URL and verify the SPA loads and points to the live backend.
