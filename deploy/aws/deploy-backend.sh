#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/hms-backend}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.backend.yml}"
ENV_FILE="${ENV_FILE:-$APP_DIR/backend.env}"

: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing backend env file: $ENV_FILE" >&2
  exit 1
fi

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
export BACKEND_IMAGE

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm backend npx prisma migrate deploy

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate --remove-orphans

docker image prune -f >/dev/null 2>&1 || true
docker logout ghcr.io >/dev/null 2>&1 || true

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
