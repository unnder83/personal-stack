#!/usr/bin/env bash
# 用法：RUNNER_TOKEN=<注册token> bash install-runner.sh
# 以 root 执行（创建用户/装 systemd 服务），Runner 进程以 ghrunner 运行
set -euo pipefail

REPO_URL="https://github.com/unnder83/personal-stack"
RUNNER_HOME=/opt/actions-runner
RUNNER_USER=ghrunner
STACK_ROOT=/opt/personal-stack

command -v docker >/dev/null || { echo "需要先安装 docker" >&2; exit 1; }
[ -n "${RUNNER_TOKEN:?需要 RUNNER_TOKEN（仓库 Settings → Actions → Runners → New runner 页面获取）}" ]

id -u "$RUNNER_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$RUNNER_USER"
usermod -aG docker "$RUNNER_USER"

dnf install -y libicu tar >/dev/null

mkdir -p "$RUNNER_HOME"
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

if [ ! -f "$RUNNER_HOME/.runner" ]; then
  if [ -n "${RUNNER_TARBALL:-}" ]; then
    # 离线/镜像场景：由调用方提供 actions-runner-linux-x64-*.tar.gz
    cp "$RUNNER_TARBALL" /tmp/actions-runner.tar.gz
  else
    ASSET_ID="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/actions/runner/releases/latest" \
      | python3 -c 'import json,sys; rel=json.load(sys.stdin); print(next(a["id"] for a in rel["assets"] if a["name"].startswith("actions-runner-linux-x64-")))')"
    curl -fsSL --retry 3 -H 'Accept: application/octet-stream' \
      "https://api.github.com/repos/actions/runner/releases/assets/$ASSET_ID" \
      -o /tmp/actions-runner.tar.gz
  fi
  tar -xzf /tmp/actions-runner.tar.gz -C "$RUNNER_HOME"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"
  rm -f /tmp/actions-runner.tar.gz
  runuser -u "$RUNNER_USER" -- "$RUNNER_HOME/config.sh" \
    --url "$REPO_URL" --token "$RUNNER_TOKEN" --name "vm-$(hostname -s)" \
    --labels self-hosted,linux,x64 --work "$RUNNER_HOME/_work" --unattended --disableupdate
fi

# 部署所需的最小权限：可写 release 目录、可读生产 env
chown -R "$RUNNER_USER:$RUNNER_USER" "$STACK_ROOT"
chmod 600 "$STACK_ROOT/.env"

# svc.sh 必须在 runner 根目录执行
cd "$RUNNER_HOME"
./svc.sh install "$RUNNER_USER"
./svc.sh start
systemctl status --no-pager 'actions.runner.*' | head -5