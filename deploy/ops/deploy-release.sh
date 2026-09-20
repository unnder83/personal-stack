#!/usr/bin/env bash
# 用法：deploy-release.sh <git-sha> [--no-rollback]
# 依赖：docker、compose v2；release 目录已由工作流解压
set -euo pipefail

SHA="${1:?用法：deploy-release.sh <git-sha>}"
NO_ROLLBACK="${2:-}"
ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
RELEASE="$ROOT/releases/$SHA"

[ -d "$RELEASE" ] || { echo "release 不存在：$RELEASE" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE" >&2; exit 1; }

API_IMAGE="ghcr.io/unnder83/personal-stack-api:$SHA"
WEB_IMAGE="ghcr.io/unnder83/personal-stack-web:$SHA"
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\n' "$API_IMAGE" "$WEB_IMAGE" > "$RELEASE/deploy/.images"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

PROFILE_ARGS=()
if grep -qE '^CLOUDFLARE_TUNNEL_TOKEN=.+' "$ENV_FILE"; then
  PROFILE_ARGS=(--profile tunnel)
fi

compose_for() {
  local dir="$1"
  shift
  docker compose --env-file "$ENV_FILE" --env-file "$dir/deploy/.images" \
    -f "$dir/deploy/compose.yaml" "${PROFILE_ARGS[@]}" "$@"
}

health_ok() {
  local dir="$1"
  for _ in $(seq 1 30); do
    if compose_for "$dir" exec -T caddy wget -qO- http://api:8000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

compose_for "$RELEASE" pull
compose_for "$RELEASE" run --rm --no-deps api alembic upgrade head
compose_for "$RELEASE" run --rm --no-deps api python -m app.scripts.seed_admin

ln -sfn "$RELEASE" "$ROOT/current"
compose_for "$RELEASE" up -d

if health_ok "$RELEASE"; then
  echo "部署成功：$SHA -> $ROOT/current"
  exit 0
fi

if [ "$NO_ROLLBACK" = "--no-rollback" ] || [ -z "$PREVIOUS" ] || [ "$PREVIOUS" = "$RELEASE" ]; then
  echo "健康检查失败，未回滚（previous='$PREVIOUS'）" >&2
  exit 1
fi

echo "健康检查失败，回滚到 $PREVIOUS" >&2
ln -sfn "$PREVIOUS" "$ROOT/current"
compose_for "$PREVIOUS" up -d
if health_ok "$PREVIOUS"; then
  echo "已回滚到 $(basename "$PREVIOUS") 并恢复健康" >&2
else
  echo "回滚后仍不健康，需人工介入" >&2
fi
exit 1
