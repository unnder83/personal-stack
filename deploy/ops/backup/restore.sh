#!/usr/bin/env bash
# 用法：
#   restore.sh --db <dump.sql.gz> [--target-db personal_stack_restore]
#   restore.sh --files <backup-dir> --target <restore-dir>
# 安全：默认恢复到 *_restore 库；恢复到生产库需显式 --target-db personal_stack 且交互确认。
set -euo pipefail

ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
# 转义后的哈希在 shell 中无意义，避免后续误传给 compose
unset GRAFANA_AUTH_HASH

COMPOSE=(docker compose -p personal-stack --env-file "$ENV_FILE" \
  --env-file "$ROOT/current/deploy/.images" -f "$ROOT/current/deploy/compose.yaml")

usage() {
  echo "用法：$0 --db <dump.sql.gz> [--target-db <db>] | --files <dir> --target <dir>" >&2
  exit 1
}

MODE="${1:-}"
shift || true

case "$MODE" in
  --files)
    SRC=""
    TARGET=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --target) TARGET="${2:?缺少 --target 的值}"; shift 2 ;;
        *) SRC="$1"; shift ;;
      esac
    done
    [ -n "$SRC" ] && [ -n "$TARGET" ] || usage
    [ -d "$SRC" ] || { echo "备份目录不存在：$SRC" >&2; exit 1; }
    case "$TARGET" in
      /srv/stack/data/*)
        echo "警告：目标位于生产数据目录：$TARGET" >&2
        read -r -p "输入 yes 确认覆盖：" answer
        [ "$answer" = "yes" ] || { echo "已取消" >&2; exit 1; }
        ;;
    esac
    mkdir -p "$TARGET"
    rsync -a "$SRC/" "$TARGET/"
    echo "文件已恢复到 $TARGET（$(du -sh "$TARGET" | cut -f1)）"
    ;;
  --db)
    DUMP=""
    TARGET_DB="personal_stack_restore"
    while [ $# -gt 0 ]; do
      case "$1" in
        --target-db) TARGET_DB="${2:?缺少 --target-db 的值}"; shift 2 ;;
        *) DUMP="$1"; shift ;;
      esac
    done
    [ -n "$DUMP" ] || usage
    [ -f "$DUMP" ] || { echo "dump 不存在：$DUMP" >&2; exit 1; }
    case "$TARGET_DB" in
      *[!A-Za-z0-9_]*) echo "非法库名：$TARGET_DB" >&2; exit 1 ;;
    esac
    if [ "$TARGET_DB" = "$MYSQL_DATABASE" ]; then
      echo "警告：即将覆盖生产库 $MYSQL_DATABASE" >&2
      read -r -p "输入 yes 确认：" answer
      [ "$answer" = "yes" ] || { echo "已取消" >&2; exit 1; }
    else
      "${COMPOSE[@]}" exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
        -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    fi
    gunzip -c "$DUMP" | "${COMPOSE[@]}" exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$TARGET_DB"
    echo "数据库已恢复到 $TARGET_DB"
    ;;
  *)
    usage
    ;;
esac
