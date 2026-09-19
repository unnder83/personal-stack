#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "用法：rollback.sh <git-sha>" >&2
  exit 1
fi

ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
RELEASE="$ROOT/releases/$1"

if [ ! -d "$RELEASE" ]; then
  echo "release 不存在：$RELEASE" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" build
docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" up -d
ln -sfn "$RELEASE" "$ROOT/current"
echo "已回滚到 $1"
