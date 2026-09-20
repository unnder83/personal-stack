#!/usr/bin/env bash
# 用法：deploy-release.sh <git-sha> [--no-rollback]
# 依赖：docker、compose v2；release 目录已由工作流解压
set -euo pipefail

SHA="${1:?用法：deploy-release.sh <git-sha>}"
NO_ROLLBACK="${2:-}"
ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
RELEASE="$ROOT/releases/$SHA"
PROJECT_NAME="personal-stack"

[ -d "$RELEASE" ] || { echo "release 不存在：$RELEASE" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE" >&2; exit 1; }
[ -f "$RELEASE/deploy/compose.yaml" ] || {
  echo "release 缺少 deploy/compose.yaml（请确认发布内容完整）" >&2
  exit 1
}

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
if grep -qE '^ENABLE_MONITORING=true' "$ENV_FILE"; then
  PROFILE_ARGS+=(--profile monitoring)
fi

compose_for() {
  local dir="$1"
  shift
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" --env-file "$dir/deploy/.images" \
    -f "$dir/deploy/compose.yaml" "${PROFILE_ARGS[@]}" "$@"
}

health_ok() {
  local dir="$1"
  for _ in $(seq 1 30); do
    # 经 Caddy 的路由检查 API 与前端，覆盖反向代理本身
    if compose_for "$dir" exec -T caddy wget -qO- http://localhost/api/health >/dev/null 2>&1 \
      && compose_for "$dir" exec -T caddy wget -qO- http://localhost/ >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

can_rollback() {
  [ "$NO_ROLLBACK" != "--no-rollback" ] \
    && [ -n "$PREVIOUS" ] \
    && [ "$PREVIOUS" != "$RELEASE" ] \
    && [ -f "$PREVIOUS/deploy/.images" ]
}

rollback() {
  local reason="$1"
  echo "$reason" >&2
  if ! can_rollback; then
    echo "无法回滚（previous='$PREVIOUS'），需人工介入" >&2
    exit 1
  fi
  echo "回滚到 $PREVIOUS" >&2
  ln -sfn "$PREVIOUS" "$ROOT/current"
  compose_for "$PREVIOUS" up -d
  if health_ok "$PREVIOUS"; then
    echo "已回滚到 $(basename "$PREVIOUS") 并恢复健康" >&2
  else
    echo "回滚后仍不健康，需人工介入" >&2
  fi
  exit 1
}

# 切换后收到 TERM/INT（含 job 超时被杀）也要尽最大努力回滚
trap 'rollback "收到中断信号，尝试回滚"' TERM INT

compose_for "$RELEASE" config >/dev/null

compose_for "$RELEASE" pull
compose_for "$RELEASE" run --rm --no-deps api alembic upgrade head
compose_for "$RELEASE" run --rm --no-deps api python -m app.scripts.seed_admin

ln -sfn "$RELEASE" "$ROOT/current"
if ! compose_for "$RELEASE" up -d; then
  rollback "compose up 失败"
fi

if health_ok "$RELEASE"; then
  trap - TERM INT
  echo "部署成功：$SHA -> $ROOT/current"
  exit 0
fi

rollback "健康检查失败"
