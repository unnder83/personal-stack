#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  echo "docker 已安装：$(docker --version)"
else
  dnf install -y dnf-plugins-core
  # Rocky 10 使用 RHEL 10 仓库（实测可达），不要用 centos 路径
  dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

mkdir -p /etc/docker
cp "$(dirname "$0")/daemon.json" /etc/docker/daemon.json

systemctl enable --now docker
systemctl restart docker
