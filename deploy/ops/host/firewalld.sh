#!/usr/bin/env bash
set -euo pipefail

systemctl enable --now firewalld
firewall-cmd --permanent --zone=public --add-service=ssh
for service in http https cockpit; do
  firewall-cmd --permanent --zone=public --remove-service="$service" >/dev/null 2>&1 || true
done
firewall-cmd --reload
firewall-cmd --list-all
