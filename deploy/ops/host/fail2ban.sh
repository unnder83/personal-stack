#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

dnf install -y epel-release >/dev/null 2>&1 || true
dnf install -y fail2ban >/dev/null
install -m 644 "$SRC_DIR/fail2ban-jail.local" /etc/fail2ban/jail.local
systemctl enable --now fail2ban
sleep 3
fail2ban-client status
fail2ban-client status sshd
