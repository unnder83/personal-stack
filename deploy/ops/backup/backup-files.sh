#!/usr/bin/env bash
# 文件备份：镜像 /srv/stack/data/files 到备份目录
set -euo pipefail

SRC="${SRC:-/srv/stack/data/files}"
DEST="${DEST:-/srv/stack/backups/files}"

[ -d "$SRC" ] || { echo "缺少源目录 $SRC" >&2; exit 1; }
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
echo "已同步文件备份：$DEST ($(du -sh "$DEST" | cut -f1))"
