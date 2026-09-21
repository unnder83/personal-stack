# personal-stack 部署教学（从零到上线）

这份文档带你从一台空 Linux 机器开始，把「个人博客 + 个人网盘」完整部署到公网，并接上自动化与运维。
每一步都给出**命令**与**预期结果**；文中标注了本项目实际踩过的坑（用「⚠️ 坑」标出），照着做可以少走弯路。

适合读者：会基本 Linux 命令、想学 Docker 与部署运维的人。

---

## 1. 架构与前置

```
Internet ──HTTPS──► Cloudflare 边缘
                        │  （cloudflared 出站隧道，本机不需要公网 IP / 端口映射）
                        ▼
                   cloudflared ──http://caddy:80──► caddy（反向代理 + 安全响应头）
                                                    ├─ /       ──► web  :8080（Nginx 托管 React 构建产物）
                                                    └─ /api/*  ──► api  :8000（FastAPI）
                                                                     └──► mysql:3306（仅容器网络）
```

生产共 5 个容器（另有可选的监控 3 个）。**不发布任何宿主机端口**，防火墙只放行 SSH。

前置需要：

- 一台 Linux（本项目用 Rocky Linux 10，RHEL 系命令通用）
- 一个域名，且能托管到 Cloudflare（免费账号即可）
- 一个 GitHub 账号（存代码、跑 CI、存镜像）
- 基本工具：`git`、`curl`、`make`

---

## 2. 系统准备

### 2.1 安装 Docker（含镜像加速与日志轮转）

仓库里已有脚本：

```bash
sudo bash deploy/ops/host/install-docker.sh
docker --version && docker compose version
```

预期：输出 `Docker version 2x.x` 与 `Docker Compose version v2.x`（或 v5.x）。

⚠️ 坑：**Docker Hub 在很多国内网络不可达**。该脚本会把 `/etc/docker/daemon.json` 配成走镜像加速器，并设置日志轮转：

```json
{
  "registry-mirrors": ["https://docker.m.daocloud.io", "https://docker.1panel.live", "https://docker.nju.edu.cn"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "max-concurrent-downloads": 8
}
```

若某个镜像拉不动，先试试其它加速器前缀并把可用的调到最前：

```bash
docker pull docker.m.daocloud.io/library/mysql:8.0 && docker tag docker.m.daocloud.io/library/mysql:8.0 mysql:8.0
```

⚠️ 坑：`download.docker.com` 用 **rhel/centos 10 的仓库**（`/linux/rhel/docker-ce.repo`），老教程里的 centos 路径在 el10 上缺包。

### 2.2 防火墙与 fail2ban

```bash
sudo bash deploy/ops/host/firewalld.sh     # 只放行 SSH（22），关掉 http/https/cockpit
sudo bash deploy/ops/host/fail2ban.sh      # 安装 fail2ban 并启用 sshd jail
sudo firewall-cmd --list-all
sudo fail2ban-client status sshd
```

预期：`services: ssh`；sshd jail 显示 `Currently banned` 等统计。

⚠️ 坑：fail2ban 不在 Rocky 基础源，脚本会先装 `epel-release`。

### 2.3 数据目录与 swap

生产数据放 `/srv/stack`。低于 4G 内存的机器建议加 swap（本项目 2.6G 内存，系统盘自带 2G swap + 这里再加 2G，共 4G）：

```bash
sudo mkdir -p /srv/stack/data/mysql /srv/stack/data/files /srv/stack/caddy/data /srv/stack/caddy/config
sudo chown -R 999:999 /srv/stack/data/mysql /srv/stack/data/files
sudo fallocate -l 2G /swapfile2 && sudo chmod 600 /swapfile2 && sudo mkswap /swapfile2 && sudo swapon /swapfile2
echo '/swapfile2 none swap sw 0 0' | sudo tee -a /etc/fstab
```

⚠️ 坑：容器里的 `api` 以非 root（uid 999）运行，宿主目录必须 `chown 999:999`，否则上传会失败。

---

## 3. 代码与密钥

### 3.1 拉代码（SSH 方式）

⚠️ 坑：很多网络环境 **HTTPS 访问 github.com 被重置**，但 **SSH（22 或 443）可用**。所以 git 远端要用 SSH：

```bash
git clone git@github.com:<你的用户名>/personal-stack.git /root/personal-stack
```

若 22 端口被限，用 443：

```bash
mkdir -p ~/.ssh && cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
EOF
chmod 600 ~/.ssh/config
```

### 3.2 生成生产密钥

```bash
sudo python3 - <<'PY'
import pathlib, secrets
env = f"""MYSQL_ROOT_PASSWORD={secrets.token_hex(16)}
MYSQL_DATABASE=personal_stack
MYSQL_USER=app
MYSQL_PASSWORD={secrets.token_hex(16)}
SECRET_KEY={secrets.token_hex(32)}
ADMIN_USERNAME=admin
ADMIN_PASSWORD={secrets.token_urlsafe(12)}
MAX_UPLOAD_SIZE_MB=2048
# Cloudflare Tunnel（见第 5 节）
# CLOUDFLARE_TUNNEL_TOKEN=
# 监控（见第 7 节，启用时取消注释；哈希里的 $ 要写成 $$）
# PUBLIC_HOST=stack.example.com
# ENABLE_MONITORING=false
# GRAFANA_ADMIN_USER=admin
# GRAFANA_ADMIN_PASSWORD=change-me
# GRAFANA_AUTH_USER=viewer
# GRAFANA_AUTH_HASH=$$2a$$14$$...
"""
path = pathlib.Path("/opt/personal-stack/.env")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(env)
path.chmod(0o600)
print("written")
PY
sudo bash -c 'grep -vE "PASSWORD|SECRET|TOKEN" /opt/personal-stack/.env'
```

预期：变量就绪，文件权限 600。

⚠️ 坑（重要）：**bcrypt 哈希里的 `$` 在 compose 环境文件里会被插值**，导致 Caddy 拿到坏哈希而启动失败。`GRAFANA_AUTH_HASH` 必须写成 `$$2a$$14$$...`。

---

## 4. 首次部署

目录约定：`/opt/personal-stack/releases/<sha>` 存每个版本的代码，`current` 是符号链接；数据全在 `/srv/stack`。

```bash
cd /root/personal-stack
SHA=$(git rev-parse --short HEAD)

# 1) 准备 release 目录（脚本要求 /opt/personal-stack/releases/<sha> 已存在）
sudo mkdir -p "/opt/personal-stack/releases/$SHA"
git archive HEAD | sudo tar -x -C "/opt/personal-stack/releases/$SHA"

# 2) 部署
sudo bash deploy/ops/deploy-release.sh "$SHA"
```

⚠️ 坑：`deploy-release.sh` 默认从 `ghcr.io/unnder83/...` 拉镜像（本项目作者的命名空间）。
如果你 fork 了仓库，请用 `GHCR_OWNER=<你的GitHub用户名>` 覆盖，例如：

```bash
sudo GHCR_OWNER=<你的用户名> bash deploy/ops/deploy-release.sh "$SHA"
```

脚本会：写 `.images`（记录本次镜像标签）→ 拉镜像 → 执行迁移 → 建管理员（幂等）→ 切换 `current` → `up -d` → 健康检查（失败自动回滚）。

预期最后输出 `部署成功：<sha> -> /opt/personal-stack/current`。

验证：

```bash
ls -l /opt/personal-stack/current
docker compose -p personal-stack --env-file /opt/personal-stack/.env \
  --env-file /opt/personal-stack/current/deploy/.images \
  -f /opt/personal-stack/current/deploy/compose.yaml ps
docker compose -p personal-stack --env-file /opt/personal-stack/.env \
  --env-file /opt/personal-stack/current/deploy/.images \
  -f /opt/personal-stack/current/deploy/compose.yaml exec -T caddy wget -qO- http://localhost/api/health
```

预期：5 个服务 Up/healthy；健康检查返回 `{"status":"ok"}`。

⚠️ 坑（事故级）：**本地冒烟/测试绝不要直接 `docker compose -f deploy/compose.yaml down`**。compose 默认项目名是文件里写死的 `personal-stack`，一条 `down` 会把生产容器删光。冒烟请显式指定独立项目名：

```bash
docker compose -p personal-stack-smoke --env-file deploy/.env.prod.example -f deploy/compose.yaml up -d
docker compose -p personal-stack-smoke --env-file deploy/.env.prod.example -f deploy/compose.yaml down
```

---

## 5. 公网接入（Cloudflare Tunnel）

无需公网 IP、无需端口映射，`cloudflared` 主动出站建隧道，TLS 由 Cloudflare 边缘终止。

1. Cloudflare 控制台 → **Zero Trust → Networks → Tunnels → Create a tunnel**（类型 Cloudflared，名字随意）
2. 复制 **token**
3. 在该隧道 **Public Hostname** 添加：Subdomain/Domain 例如 `stack` + `example.com`，Service 选 **HTTP**，URL 填 `caddy:80`
4. 把 token 写入 `/opt/personal-stack/.env`：

```bash
sudo sed -i 's|^# CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=<你的token>|' /opt/personal-stack/.env
sudo bash deploy/ops/deploy-release.sh <sha>
docker compose -p personal-stack --env-file /opt/personal-stack/.env \
  --env-file /opt/personal-stack/current/deploy/.images \
  -f /opt/personal-stack/current/deploy/compose.yaml --profile tunnel logs --tail=20 cloudflared
```

预期：日志出现 `Registered tunnel connection`（4 条）。

验证公网：

```bash
curl -sS https://stack.example.com/api/health
```

预期：`{"status":"ok"}`。

⚠️ 坑：`1016 Origin DNS error` / `1034` 多半是 Public Hostname 没配或 DNS 记录没生成；`530` 常见于隧道没连上。

⚠️ 坑：cloudflared 默认 QUIC 在部分线路被严重限速（实测 0.08MB/s）。本项目改用 HTTP/2（compose 里 `--protocol http2`），提速约 9 倍。Cloudflare 免费版还有 **单请求 100MB 上限**与 **源站 100 秒超时**，大文件上传会失败（分块上传是二期方案）。

### 5.1 真实客户端 IP（限流依赖它）

三段链路缺一不可：

| 环节 | 配置 |
|---|---|
| cloudflared | 自动传递 `X-Forwarded-For` |
| Caddy | `trusted_proxies static 172.28.0.0/16` + `trusted_proxies_strict` |
| api | `uvicorn --proxy-headers --forwarded-allow-ips=172.28.0.0/16` |

验证（伪造 XFF 不应转移限流桶）：

```bash
HOST=stack.example.com bash deploy/ops/xff-check.sh
```

预期：伪造第二个 XFF 仍返回 429。

---

## 6. CI/CD（push 自动上线）

两条工作流：

- `release.yml`（GitHub 云端）：push 到 `main` 构建 `ghcr.io/<owner>/personal-stack-{api,web}:<sha>` 并推送（纯文档变更被 `paths-ignore` 跳过）
- `deploy.yml`（VM 自托管 Runner）：校验该 sha 仍是 `main` 最新 → 经 `api.github.com` 下载 tarball → 调用 `deploy-release.sh` → 自动部署与回滚

### 6.1 安装自托管 Runner（非 root）

1. GitHub 仓库 → Settings → Actions → Runners → New self-hosted runner，复制 `--token`
2. 安装：

```bash
sudo RUNNER_TOKEN=<注册token> bash deploy/ops/host/install-runner.sh
sudo systemctl status 'actions.runner.*' --no-pager | head -5
```

预期：服务 active；`ghrunner` 在 docker 组；无 sudoers 条目。

⚠️ 坑：Runner 安装包从 GitHub Release 下载，国内可能极慢（226MB）。脚本支持离线包：

```bash
# 在本机用镜像下载后传入
curl -L -o /tmp/runner.tar.gz https://gh-proxy.com/https://github.com/actions/runner/releases/download/<版本>/actions-runner-linux-x64-<版本>.tar.gz
sudo RUNNER_TOKEN=<token> RUNNER_TARBALL=/tmp/runner.tar.gz bash deploy/ops/host/install-runner.sh
```

⚠️ 坑：Runner 自更新走 github.com 会失败，安装脚本用 `--disableupdate` 关闭。

### 6.2 验证与回滚演练

- 随便 push 一个提交，观察 Actions：`Release` 绿 → `Deploy` 绿 → `readlink -f /opt/personal-stack/current` 变为新 sha
- 演练回滚：临时把 `backend/app/main.py` 的健康检查改成抛异常 → push → Deploy 失败且 `current` 自动回到上一个 sha → `git revert` 恢复

⚠️ 坑：GHCR 拉取慢（本项目实测 10–19 分钟/次，层已缓存时 <1 分钟），Deploy job 设了 30 分钟超时。

---

## 7. 监控（Prometheus + Grafana）

在 `/opt/personal-stack/.env` 中启用：

```bash
PUBLIC_HOST=stack.example.com
ENABLE_MONITORING=true
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<强随机>
GRAFANA_AUTH_USER=viewer
GRAFANA_AUTH_HASH=$$2a$$14$$<caddy hash-password 的输出去掉前缀$后自行转义>
```

生成哈希：

```bash
docker run --rm caddy:2.11.4-alpine caddy hash-password --plaintext '<viewer的密码>'
```

然后重新部署。访问 `https://stack.example.com/grafana/`：

- 第一层：basic auth（`viewer` + 上面密码），由 Caddy 校验
- 第二层：Grafana 登录（`admin` + `GRAFANA_ADMIN_PASSWORD`）

⚠️ 坑：Caddy 代理到 Grafana 必须剥离 basic auth 头（`header_up -Authorization`），否则 Grafana 会用 `viewer` 尝试自己的 Basic 认证导致登录被拒。

⚠️ 坑：Grafana 11.x 的登录接口是 **JSON**（`POST /grafana/login`，body `{"user":...,"password":...}`）；用表单编码测试会得到 400。

验证抓取目标：

```bash
docker compose -p personal-stack ... exec -T api python -c "
import json, urllib.request
print(json.load(urllib.request.urlopen('http://prometheus:9090/api/v1/targets?state=active'))['data']['activeTargets'])
"
```

⚠️ 坑：cAdvisor 镜像在 gcr.io，国内不可达；一期未包含容器级指标（用 node-exporter + 应用 `/metrics`）。

---

## 8. 备份与恢复

安装每日定时备份（03:30，systemd timer）：

```bash
sudo bash deploy/ops/systemd/install-backup-timer.sh
sudo systemctl start personal-stack-backup.service      # 立刻跑一次验证
sudo journalctl -u personal-stack-backup.service -n 20 --no-pager
ls -lh /srv/stack/backups/db/daily /srv/stack/backups/files
```

该服务依次执行两个脚本：`deploy/ops/backup/backup-db.sh`（mysqldump + gzip + 校验）与
`deploy/ops/backup/backup-files.sh`（rsync 镜像文件目录）。也可以手动单独运行它们排查问题。

产物：

- MySQL：`/srv/stack/backups/db/daily/personal_stack-YYYY-MM-DD.sql.gz`（保留 7 天）+ `weekly/`（周日副本，保留 4 周），权限 600
- 文件：`/srv/stack/backups/files`（rsync 镜像）

⚠️ 坑：systemd 服务默认落在受限 SELinux 域，`rsync` 会被拒绝读 `/srv/stack`（`avc: denied`）。`personal-stack-backup.service` 里显式设置了 `SELinuxContext=system_u:system_r:unconfined_service_t:s0`。

恢复（默认恢复到独立库，不碰生产）：

```bash
DUMP=$(ls -t /srv/stack/backups/db/daily/*.sql.gz | head -1)
bash deploy/ops/backup/restore.sh --db "$DUMP" --target-db personal_stack_restore
bash deploy/ops/backup/restore.sh --files /srv/stack/backups/files --target /tmp/restore-verify
```

预期：库恢复成功；文件目录可对比哈希。恢复到生产库需显式 `--target-db personal_stack` 并输入 `yes` 确认。

---

## 9. 安全加固现状

| 项 | 状态 |
|---|---|
| 防火墙 | 仅放行 SSH |
| fail2ban | sshd jail（5 次/10 分钟封 1 小时） |
| SSH | 仍支持密码登录（本项目用户选择暂缓密钥化；建议后续改公钥并禁 root） |
| Cookie | `HttpOnly + Secure + SameSite=Lax`，生产 `COOKIE_SECURE=true` |
| 登录限流 | 应用层按真实 IP 5 次/分钟 |
| 容器 | 4 个服务 `cap_drop: ALL` + `read_only` + `no-new-privileges`；mysql 仅 `no-new-privileges`（官方入口需特权） |
| 响应头 | HSTS + CSP（Grafana 路由不套 CSP） |
| 镜像 | 外部镜像按 `tag@digest` 固定；自建镜像按 sha 标签 |
| 备份 | 产物权限 600；同盘备份仅防误删，异地备份为二期 |
| 监控入口 | Grafana 双层认证（Caddy basic auth + Grafana 登录） |

---

## 10. 故障排查（真实坑清单）

| 现象 | 原因与处理 |
|---|---|
| `git clone` github.com 超时 | HTTPS 被重置；改用 SSH（22 或 `ssh.github.com:443`） |
| 拉镜像超时 | Docker Hub 不可达；确认 `daemon.json` 的 registry-mirrors 生效 |
| Runner 下载安装包极慢 | 用 `gh-proxy.com` 等镜像下载后以 `RUNNER_TARBALL` 传入 |
| `cryptography package is required` | MySQL 8 默认 `caching_sha2_password`；安装 `cryptography`（已在 requirements） |
| `greenlet_spawn has not been called` | 异步下访问了未加载的关系；用 `selectin`/显式 `refresh` |
| Caddy 起不来且日志报 hash 错误 | `.env` 里 bcrypt 的 `$` 未转义成 `$$` |
| Grafana 登录总 401 | Caddy 转发 basic auth 头；加 `header_up -Authorization`；且登录接口要 JSON |
| 前端 Console 报 CSP 拦截 cloudflareinsights | Cloudflare Web Analytics 信标；已在 CSP 放行该域，或在 CF 后台关闭 Analytics |
| systemd 备份报 rsync code 23 | SELinux `rsync_t` 拒读；服务加 `unconfined_service_t` |
| 公网 502 | `caddy`/`web` 容器异常；`docker compose ps` 与 `logs` 排查 |
| 公网 530/1016 | Cloudflare 主机名或隧道未连接 |
| 上传大文件失败 | Cloudflare 免费版 100MB/100s 限制；先用较小文件，或等分块上传功能 |
| 主机内存不足 | `free -m`；本项目加了 4G swap，监控栈约 130MB |
| 磁盘将满 | `df -h`；`deploy-release.sh` 会保留最近 5 个 release 并清理悬空镜像 |

---

## 11. 命令速查

```bash
# 开发
make setup-backend         # 创建后端 venv 并装依赖
make dev-up / dev-down     # 开发环境（mysql + api 热重载 + vite）
make db-up / migrate / seed-admin
make check-backend / check-frontend    # 测试与检查

# 生产（compose 路径随 current 变化）
COMPOSE="docker compose -p personal-stack --env-file /opt/personal-stack/.env \
  --env-file /opt/personal-stack/current/deploy/.images \
  -f /opt/personal-stack/current/deploy/compose.yaml"
$COMPOSE ps
$COMPOSE logs -f --tail=100 api
$COMPOSE exec -T caddy wget -qO- http://localhost/api/health

# 部署与回滚
sudo bash deploy/ops/deploy-release.sh <sha>          # 部署指定版本（失败自动回滚）
sudo bash deploy/ops/deploy-release.sh <sha> --no-rollback

# 备份与恢复
sudo systemctl start personal-stack-backup.service
bash deploy/ops/backup/restore.sh --db <dump> [--target-db <db>]

# 监控
$COMPOSE --profile monitoring ps

# 数据位置
/opt/personal-stack/{releases,current,.env}
/srv/stack/{data/mysql,data/files,caddy,backups}
```

---

## 附：首次上线检查清单

- [ ] `docker compose ps` 全部 Up/healthy，宿主机 `ss -tlnp` 只有 22
- [ ] `curl https://<域名>/api/health` 返回 ok
- [ ] 浏览器登录、发文章、上传下载文件各一次
- [ ] `HOST=<域名> bash deploy/ops/xff-check.sh` 通过
- [ ] Actions 上 `Release`/`Deploy`/`CI` 全绿
- [ ] Grafana 有数据（启用监控时）
- [ ] 手动跑一次备份并检查产物
- [ ] 演练一次回滚（至少确认 `current` 可切换）
