#!/usr/bin/env bash
# 每日备份 MySQL：保留 7 天日备 + 4 周周备（周日副本）
set -euo pipefail
umask 077

ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
BACKUP_DIR="${BACKUP_DIR:-/srv/stack/backups/db}"

[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE" >&2; exit 1; }
[ -d "$ROOT/current" ] || { echo "缺少 $ROOT/current" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
# 转义后的哈希在 shell 中无意义，避免后续误传给 compose
unset GRAFANA_AUTH_HASH

COMPOSE=(docker compose -p personal-stack --env-file "$ENV_FILE" \
  --env-file "$ROOT/current/deploy/.images" -f "$ROOT/current/deploy/compose.yaml")

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
STAMP="$(date +%F)"
TARGET="$BACKUP_DIR/daily/personal_stack-$STAMP.sql.gz"

TMP_TARGET="$TARGET.tmp"
"${COMPOSE[@]}" exec -T mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers "$MYSQL_DATABASE" | gzip > "$TMP_TARGET"
gzip -t "$TMP_TARGET" || { echo "备份文件校验失败" >&2; rm -f "$TMP_TARGET"; exit 1; }
mv "$TMP_TARGET" "$TARGET"
echo "已备份：$TARGET ($(du -h "$TARGET" | cut -f1))"

if [ "$(date +%u)" = "7" ]; then
  cp "$TARGET" "$BACKUP_DIR/weekly/personal_stack-$STAMP.sql.gz"
  echo "已生成周备副本"
fi

find "$BACKUP_DIR/daily" -name 'personal_stack-*.sql.gz' -mtime +7 -delete
find "$BACKUP_DIR/weekly" -name 'personal_stack-*.sql.gz' -mtime +28 -delete
