#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
install -m 644 "$SRC_DIR/personal-stack-backup.service" /etc/systemd/system/
install -m 644 "$SRC_DIR/personal-stack-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now personal-stack-backup.timer
systemctl list-timers personal-stack-backup.timer --no-pager
