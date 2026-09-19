#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/personal-stack}"
ROOT="${ROOT:-/opt/personal-stack}"
STACK="${STACK:-/srv/stack}"
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "缺少 $ENV_FILE（从 deploy/.env.prod.example 复制并改成强随机值）" >&2
  exit 1
fi

SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
RELEASE="$ROOT/releases/$SHA"

mkdir -p "$ROOT/releases" \
  "$STACK/data/mysql" "$STACK/data/files" \
  "$STACK/caddy/data" "$STACK/caddy/config"
chown -R 999:999 "$STACK/data/mysql" "$STACK/data/files"

if [ ! -d "$RELEASE" ]; then
  mkdir -p "$RELEASE"
  git -C "$REPO_DIR" archive HEAD | tar -x -C "$RELEASE"
fi

PROFILE_ARGS=()
if grep -qE '^CLOUDFLARE_TUNNEL_TOKEN=.+' "$ENV_FILE"; then
  PROFILE_ARGS=(--profile tunnel)
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" "${PROFILE_ARGS[@]}")

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" run --rm api alembic upgrade head
"${COMPOSE[@]}" run --rm api python -m app.scripts.seed_admin

ln -sfn "$RELEASE" "$ROOT/current"
echo "已部署 $SHA -> $ROOT/current"
