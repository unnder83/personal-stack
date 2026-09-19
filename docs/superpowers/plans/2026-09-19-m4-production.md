# M4 生产部署（Cloudflare Tunnel + 生产编排 + 首次上线） 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把应用以生产形态部署到本机：5 容器编排（cloudflared/caddy/web/api/mysql）、不暴露任何宿主机端口、通过 Cloudflare Tunnel 提供 HTTPS 访问，并完成首次上线与安全验证。

**Architecture:** Cloudflare 边缘终止 TLS → `cloudflared` 出站隧道 → `caddy` 反向代理（`/` → `web:8080`，`/api/*` → `api:8000`）→ `api` → `mysql`。生产代码放在 `/opt/personal-stack/releases/<sha>`（`current` 符号链接），数据放 `/srv/stack`。

**Tech Stack:** Docker Compose、Caddy 2、Cloudflare Tunnel、Nginx（前端静态）、既有 FastAPI/MySQL。

**Spec:** `docs/superpowers/specs/2026-09-19-personal-stack-design.md`（§5.1 生产拓扑、§9 部署目录、§11.3/11.4 安全与 HTTPS）

## Global Constraints

- 生产根 `/opt/personal-stack`：`releases/<git-sha>/` 为不可变发布目录，`current` 符号链接指向当前版本；数据根 `/srv/stack`：`data/mysql`、`data/files`、`caddy/`。
- 生产环境变量文件 `/opt/personal-stack/.env`（权限 600、不入库）；仓库只保留 `deploy/.env.prod.example`（占位值）。
- **生产不发布任何宿主机端口**（cloudflared 出站隧道）；宿主防火墙仅放行 SSH。
- 固定 compose 子网 `172.28.0.0/16`；Caddy `trusted_proxies static 172.28.0.0/16`，api 以 `--proxy-headers --forwarded-allow-ips=172.28.0.0/16` 启动，三段链路保证真实客户端 IP 到达登录限流。
- 生产 `COOKIE_SECURE=true`（HTTPS 下 Cookie 才可下发）。
- `web` 容器以非 root 用户运行，Nginx 监听 8080；`api` 已有非 root 与健康检查。
- 镜像在本机构建（GHCR 与自托管 Runner 属 M5）；部署脚本幂等，同一 sha 重复执行不产生副作用。
- 提交信息使用中文 conventional commits；开发环境（`compose.dev.yaml`）保持可用。

## Review Focus

以下五类风险最可能在生产环境咬人；每一行都在对应任务钉了验证。

1. **真实客户端 IP 链路**：从隧道到限流的三段信任配置缺一不可；伪造 `X-Forwarded-For` 不应把不同 IP 合并成一个桶。钉在 Task 5（两个伪造 XFF 分桶验证）。
2. **无端口暴露**：生产 compose 不发布 3306/8000/5173/80/443；`docker compose ps` 无 `0.0.0.0:` 映射，`ss -tlnp` 仅 22。钉在 Task 5。
3. **数据持久性与属主**：`/srv/stack/data/{mysql,files}` 属主正确（uid 999），容器与整机重启后数据仍在，发布新 release 不丢数据。钉在 Task 5（重启持久性验证）。
4. **HTTPS 下的 Cookie 与会话**：`COOKIE_SECURE=true` 且经 HTTPS 登录后 `/api/auth/me` 正常；HTTP 访问不产生会话。钉在 Task 5。
5. **部署脚本幂等与回滚**：重复 `deploy.sh` 同一 sha 不重建/不丢数据；`rollback.sh` 切回旧 release 后服务与数据正常。钉在 Task 3（`bash -n` 与幂等检查）与 Task 5。

---

### Task 1: 生产 Caddy 配置与前端生产镜像

**Files:**
- Create: `deploy/Caddyfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Consumes: 既有 `frontend/` 工程与 `backend/Dockerfile`。
- Produces: 镜像 `personal-stack-web`（Nginx 非 root，监听 8080，SPA history 回退）；`deploy/Caddyfile`（`/api/*` → `api:8000`，其余 → `web:8080`，含安全响应头与 JSON 访问日志）。

- [ ] **Step 1: 写生产 Caddyfile**

`deploy/Caddyfile`：

```caddyfile
{
	servers {
		trusted_proxies static 172.28.0.0/16
	}
}

:80 {
	encode gzip

	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}

	handle /api/* {
		reverse_proxy api:8000
	}

	handle {
		reverse_proxy web:8080
	}

	log {
		output stdout
		format json
	}
}
```

- [ ] **Step 2: 写前端生产镜像**

`frontend/nginx.conf`：

```nginx
server {
    listen 8080;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`frontend/Dockerfile`：

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN addgroup -S app && adduser -S -G app app \
    && chown -R app:app /usr/share/nginx/html /var/cache/nginx /var/run /etc/nginx/conf.d
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
```

`frontend/.dockerignore`：

```text
node_modules/
dist/
```

- [ ] **Step 3: 验证 Caddy 配置语法**

```bash
docker run --rm -v "$PWD/deploy/Caddyfile":/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

预期：`Valid configuration`。

- [ ] **Step 4: 构建并冒烟前端镜像**

```bash
docker build -t personal-stack-web:test frontend
docker run -d --rm -p 18080:8080 --name web-test personal-stack-web:test
sleep 2
curl -sf http://localhost:18080/ | grep -q "personal-stack" && echo "index OK"
curl -sf -o /dev/null -w 'spa-fallback: %{http_code}\n' http://localhost:18080/admin/posts
docker exec web-test id -un
docker inspect --format '{{.State.Health.Status}}' web-test
docker stop web-test
```

预期：`index OK`、SPA 回退 200、容器用户 `app`、健康状态 `healthy`。

- [ ] **Step 5: 提交**

```bash
git add deploy/Caddyfile frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "feat: 生产 Caddy 配置与前端非 root 镜像"
```

---

### Task 2: 生产编排 compose.yaml

**Files:**
- Create: `deploy/compose.yaml`
- Create: `deploy/.env.prod.example`

**Interfaces:**
- Consumes: Task 1 的 web 镜像与 Caddyfile；`backend/Dockerfile`。
- Produces: 生产编排（`cloudflared`[profile `tunnel`]、`caddy`、`web`、`api`、`mysql`），固定子网 `172.28.0.0/16`，无端口发布；Task 3 的部署脚本与 Task 5 的上线都基于它。

- [ ] **Step 1: 写生产 compose**

`deploy/compose.yaml`：

```yaml
name: personal-stack

networks:
  appnet:
    ipam:
      config:
        - subnet: 172.28.0.0/16

services:
  mysql:
    image: mysql:8.0
    restart: unless-stopped
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - ${STACK_DATA:-/srv/stack}/data/mysql:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s
    networks: [appnet]

  api:
    build:
      context: ../backend
    restart: unless-stopped
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=172.28.0.0/16
    environment:
      DATABASE_URL: mysql+asyncmy://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      SECRET_KEY: ${SECRET_KEY}
      MAX_UPLOAD_SIZE_MB: ${MAX_UPLOAD_SIZE_MB}
      COOKIE_SECURE: "true"
      ADMIN_USERNAME: ${ADMIN_USERNAME}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    volumes:
      - ${STACK_DATA:-/srv/stack}/data/files:/app/data/files
    depends_on:
      mysql:
        condition: service_healthy
    networks: [appnet]

  web:
    build:
      context: ../frontend
    restart: unless-stopped
    networks: [appnet]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ${STACK_DATA:-/srv/stack}/caddy/data:/data
      - ${STACK_DATA:-/srv/stack}/caddy/config:/config
    depends_on: [api, web]
    networks: [appnet]

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    profiles: ["tunnel"]
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on: [caddy]
    networks: [appnet]
```

- [ ] **Step 2: 写生产环境变量模板**

`deploy/.env.prod.example`：

```dotenv
# 生产环境变量：复制到 /opt/personal-stack/.env 后改成强随机值，chmod 600
MYSQL_ROOT_PASSWORD=change-me-root
MYSQL_DATABASE=personal_stack
MYSQL_USER=app
MYSQL_PASSWORD=change-me-app
SECRET_KEY=change-me-64-hex
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-admin
MAX_UPLOAD_SIZE_MB=2048
# 前往 Cloudflare Zero Trust 创建 Tunnel 后取消注释并填入 token
# CLOUDFLARE_TUNNEL_TOKEN=change-me-tunnel-token
```

- [ ] **Step 3: 校验 compose 解析与无端口发布**

```bash
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml config | grep -E "published|172.28" | head -5
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml config --services
```

预期：输出中没有 `published:` 行（无端口映射）；服务列表为 `mysql api web caddy cloudflared`。

- [ ] **Step 4: 本机无隧道冒烟（不含 cloudflared，数据落临时目录）**

```bash
export STACK_DATA=/tmp/prod-smoke
mkdir -p "$STACK_DATA/data/mysql" "$STACK_DATA/data/files" "$STACK_DATA/caddy/data" "$STACK_DATA/caddy/config"
chown -R 999:999 "$STACK_DATA/data/mysql" "$STACK_DATA/data/files"
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml exec -T caddy wget -qO- http://api:8000/api/health
echo
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml exec -T caddy wget -qO- http://web:8080/ | grep -q personal-stack && echo "web OK"
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml ps --format "table {{.Service}}\t{{.Status}}"
docker compose --env-file deploy/.env.prod.example -f deploy/compose.yaml down
rm -rf "$STACK_DATA"
```

预期：`{"status":"ok"}`；`web OK`；四个服务（无 cloudflared）运行且 api/mysql 健康。
说明：`STACK_DATA` 指向 `/tmp/prod-smoke`，避免用占位口令初始化真正的 `/srv/stack/data/mysql`（否则真实上线时数据库口令不一致）。

- [ ] **Step 5: 提交**

```bash
git add deploy/compose.yaml deploy/.env.prod.example
git commit -m "feat: 生产编排（cloudflared/caddy/web/api/mysql，无端口发布）"
```

---

### Task 3: 部署脚本与宿主防火墙

**Files:**
- Create: `deploy/ops/deploy.sh`
- Create: `deploy/ops/rollback.sh`
- Create: `deploy/ops/host/firewalld.sh`

**Interfaces:**
- Consumes: Task 2 的 `deploy/compose.yaml`。
- Produces: `deploy.sh`（release 目录 + 构建 + 启动 + 迁移 + 种子 + 切 `current`，幂等）、`rollback.sh <sha>`、`firewalld.sh`（仅放行 SSH）。

- [ ] **Step 1: 写部署脚本**

`deploy/ops/deploy.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/personal-stack}"
ROOT="${ROOT:-/opt/personal-stack}"
STACK="${STACK:-/srv/stack}"
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "缺少 $ENV_FILE（从 deploy/.env.prod.example 复制并改成强随机值）" >&2
  exit 1
fi

SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
RELEASE="$ROOT/releases/$SHA"

mkdir -p "$ROOT/releases" \
  "$STACK/data/mysql" "$STACK/data/files" \
  "$STACK/caddy/data" "$STACK/caddy/config"
chown -R 999:999 "$STACK/data/mysql" "$STACK/data/files"

if [ ! -d "$RELEASE" ]; then
  mkdir -p "$RELEASE"
  git -C "$REPO_DIR" archive HEAD | tar -x -C "$RELEASE"
fi

PROFILE_ARGS=()
if grep -qE '^CLOUDFLARE_TUNNEL_TOKEN=.+' "$ENV_FILE"; then
  PROFILE_ARGS=(--profile tunnel)
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" "${PROFILE_ARGS[@]}")

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" run --rm api alembic upgrade head
"${COMPOSE[@]}" run --rm api python -m app.scripts.seed_admin

ln -sfn "$RELEASE" "$ROOT/current"
echo "已部署 $SHA -> $ROOT/current"
```

`deploy/ops/rollback.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "用法：rollback.sh <git-sha>" >&2
  exit 1
fi

ROOT="${ROOT:-/opt/personal-stack}"
ENV_FILE="$ROOT/.env"
RELEASE="$ROOT/releases/$1"

if [ ! -d "$RELEASE" ]; then
  echo "release 不存在：$RELEASE" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" build
docker compose --env-file "$ENV_FILE" -f "$RELEASE/deploy/compose.yaml" up -d
ln -sfn "$RELEASE" "$ROOT/current"
echo "已回滚到 $1"
```

`deploy/ops/host/firewalld.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

systemctl enable --now firewalld
firewall-cmd --permanent --zone=public --add-service=ssh
for service in http https cockpit; do
  firewall-cmd --permanent --zone=public --remove-service="$service" >/dev/null 2>&1 || true
done
firewall-cmd --reload
firewall-cmd --list-all
```

- [ ] **Step 2: 赋执行权限并做语法检查**

```bash
chmod +x deploy/ops/deploy.sh deploy/ops/rollback.sh deploy/ops/host/firewalld.sh
bash -n deploy/ops/deploy.sh && bash -n deploy/ops/rollback.sh && bash -n deploy/ops/host/firewalld.sh && echo "syntax OK"
```

预期：`syntax OK`。

- [ ] **Step 3: 应用宿主防火墙**

```bash
bash deploy/ops/host/firewalld.sh
ss -tlnp | grep -E ":(80|443|3306|5173|8000) " || echo "no app ports listening on host"
```

预期：firewalld 生效且仅 ssh 放行；宿主机没有应用端口监听（开发 compose 若在运行会占用 3306/8000/5173，先 `make dev-down` 再验证）。

- [ ] **Step 4: 验证部署脚本的幂等前置检查**

```bash
test -f /opt/personal-stack/.env || echo "expected-missing-env"
ROOT=/tmp/deploy-test bash deploy/ops/deploy.sh 2>&1 | head -2
```

预期：输出 `expected-missing-env`；脚本以「缺少 /opt/personal-stack/.env」退出（非 0），不产生副作用。

- [ ] **Step 5: 提交**

```bash
git add deploy/ops/deploy.sh deploy/ops/rollback.sh deploy/ops/host/firewalld.sh
git commit -m "feat: 生产部署/回滚脚本与宿主防火墙"
```

---

### Task 4: Cloudflare Tunnel 接入（需要你操作）

**Files:**
- Modify: `/root/user-tasks.md`（宿主机文件，不入库）
- Modify: `/opt/personal-stack/.env`（宿主机文件，不入库）

**Interfaces:**
- Consumes: Task 2 的 `cloudflared` 服务定义。
- Produces: 可用的公网 HTTPS 入口（Cloudflare 边缘 → 隧道 → caddy）。

- [ ] **Step 1: 写入你的域名信息（需要你提供）**

请告诉我你要用的完整主机名（例如 `stack.example.com`），我会写进任务文件；同时你需要完成下面的 Cloudflare 操作。

- [ ] **Step 2: 用户操作——创建 Tunnel 并配置路由（需要你动手）**

更新 `/root/user-tasks.md`，请你在浏览器完成：

1. 登录 Cloudflare → **Zero Trust** → Networks → Tunnels → **Create a tunnel** → 选 **Cloudflared** → 名字 `personal-stack` → 保存
2. 复制生成的 **token**（一串很长的字符）
3. 在该 tunnel 的 **Public Hostname** 页添加：
   - Subdomain/Domain：你的主机名（如 `stack` + `example.com`）
   - Service：`HTTP` → `caddy:80`
4. 把 token 告诉我，我会写入 `/opt/personal-stack/.env` 的 `CLOUDFLARE_TUNNEL_TOKEN`（权限 600）

- [ ] **Step 3: 写入 token 并启动隧道**

```bash
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=' /opt/personal-stack/.env || echo 'CLOUDFLARE_TUNNEL_TOKEN=' >> /opt/personal-stack/.env
# 把 <TOKEN> 换成实际 token 后执行（不要写进仓库）
# sed -i 's|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=<TOKEN>|' /opt/personal-stack/.env
chmod 600 /opt/personal-stack/.env
ROOT=/opt/personal-stack bash deploy/ops/deploy.sh
docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml ps --format "table {{.Service}}\t{{.Status}}"
```

预期：5 个服务全部 Up；cloudflared 日志无报错：

```bash
docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml logs --tail=20 cloudflared
```

- [ ] **Step 4: 验证 HTTPS 入口**

```bash
# 把 <your-host> 换成你的主机名
curl -sS -o /dev/null -w 'https status: %{http_code}\n' https://<your-host>/api/health
curl -sS https://<your-host>/api/health
echo
curl -sS -o /dev/null -w 'spa: %{http_code}\n' https://<your-host>/
```

预期：`https status: 200`、`{"status":"ok"}`、SPA 200。

- [ ] **Step 5: 提交（仅任务文件变更，仓库无 secrets）**

```bash
git status --porcelain
```

预期：仓库工作区干净（token 只在 `/opt/personal-stack/.env`）。

---

### Task 5: 首次上线与安全验证

**Files:**
- 无仓库文件变更（验证与记录）

**Interfaces:**
- Consumes: Task 1–4 全部产物。
- Produces: 首次上线记录与五类 Review Focus 的实证。

- [ ] **Step 1: 无端口暴露与容器状态**

```bash
docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
ss -tlnp | grep -E ":(\d+)" | grep -v ":22 " | head -5
```

预期：容器列表 Ports 列为空或仅内部端口；宿主机除 22 外无监听（docker 内部网桥地址可接受）。

- [ ] **Step 2: HTTPS 登录、Cookie Secure 与草稿/公开链路**

```bash
HOST=<your-host>
rm -f /tmp/ck5.txt
curl -sS -c /tmp/ck5.txt -X POST "https://$HOST/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<生产 ADMIN_PASSWORD>"}' | head -c 200
echo
grep -q "Secure" /tmp/ck5.txt && echo "cookie Secure OK" || echo "cookie Secure MISSING"
curl -sS -b /tmp/ck5.txt "https://$HOST/api/auth/me"
echo
```

预期：登录返回用户 JSON；Cookie jar 中 `access_token` 为 secure；`/me` 返回 200。

- [ ] **Step 3: 真实 IP 分桶（关键回归验证）**

```bash
COMPOSE="docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml"
$COMPOSE run --rm --no-deps --entrypoint python api - <<'PY'
import json
import urllib.error
import urllib.request


def attempt(ip: str) -> None:
    request = urllib.request.Request(
        "http://api:8000/api/auth/login",
        data=json.dumps({"username": "admin", "password": "wrong"}).encode(),
        headers={"Content-Type": "application/json", "X-Forwarded-For": ip},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            print(ip, response.status, "unexpected-success")
    except urllib.error.HTTPError as error:
        body = error.read().decode()[:60]
        print(ip, error.code, body)


for _ in range(6):
    attempt("203.0.113.7")
attempt("203.0.113.8")
PY
```

预期：`203.0.113.7` 前 5 次为 401 `invalid_credentials`，第 6 次为 429 `rate_limited`；`203.0.113.8` 为 401（独立桶，证明按真实 IP 分桶）。
说明：探针从 appnet 网段的一性容器发出（源 IP 在 `172.28.0.0/16` 内），uvicorn 才信任其 `X-Forwarded-For`。若 `203.0.113.8` 也返回 429，说明 IP 链路配置有误，必须修复后再继续。

- [ ] **Step 4: 上传下载与重启持久性**

```bash
COMPOSE="docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml"
head -c 1048576 /dev/urandom > /tmp/prod-1mb.bin
sha256sum /tmp/prod-1mb.bin | awk '{print $1}' > /tmp/prod.sha
FILE_ID=$(curl -sS -b /tmp/ck5.txt -F "file=@/tmp/prod-1mb.bin" "https://<your-host>/api/files/upload" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
curl -sS -b /tmp/ck5.txt -o /tmp/prod-out.bin "https://<your-host>/api/files/$FILE_ID/download"
sha256sum /tmp/prod-out.bin | awk '{print $1}' | diff - /tmp/prod.sha && echo "HASH MATCH"
# 重启后仍在
$COMPOSE restart >/dev/null
sleep 20
curl -sS -b /tmp/ck5.txt "https://<your-host>/api/files/$FILE_ID/download" -o /tmp/prod-out2.bin
sha256sum /tmp/prod-out2.bin | awk '{print $1}' | diff - /tmp/prod.sha && echo "PERSISTED AFTER RESTART"
# 清理
curl -sS -b /tmp/ck5.txt -X DELETE "https://<your-host>/api/files/$FILE_ID" >/dev/null
rm -f /tmp/prod-1mb.bin /tmp/prod-out.bin /tmp/prod-out2.bin
```

预期：`HASH MATCH` 与 `PERSISTED AFTER RESTART`。

- [ ] **Step 5: 记录上线结果**

把上述验证结果写入 `docs/deploy-notes.md`（创建）：部署时间、release sha、域名、验证项与结果。提交：

```bash
git add docs/deploy-notes.md
git commit -m "docs: 记录 M4 首次上线与安全验证结果"
git push
```

- [ ] **Step 6: 用户操作——浏览器验证（需要你动手）**

更新 `/root/user-tasks.md`，请在浏览器完成：

1. 打开 `https://<your-host>/`，确认 HTTPS 锁标、博客首页可访问
2. 登录后发布一篇文章，确认访客可见
3. 网盘上传/下载一个文件
4. 打开手机流量（不同网络）再访问，确认同样可用

---

### Task 6: 运维手册与文档收尾

**Files:**
- Create: `docs/operations.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 3 的脚本、Task 5 的上线记录。
- Produces: 部署/回滚/排障/数据位置/备份提示的运维手册。

- [ ] **Step 1: 写运维手册**

`docs/operations.md` 覆盖：生产目录结构、首次部署、日常发布（`deploy.sh`）、回滚、查看日志、数据位置与权限、Cloudflare Tunnel 要点（token 位置、主机名配置在 CF 控制台）、常见故障（cloudflared 未连、Caddy 502、MySQL 未就绪、限流误伤排查）、备份入口（指向 M6 计划）。

- [ ] **Step 2: README 增加生产入口**

在 README 的「目录」表后增加一节：

```markdown
## 生产部署

- 入口：https://<your-host> （Cloudflare Tunnel，无公网端口）
- 部署：`deploy/ops/deploy.sh`；回滚：`deploy/ops/rollback.sh <sha>`
- 运维手册：`docs/operations.md`
```

- [ ] **Step 3: 提交并推送**

```bash
git add docs/operations.md README.md
git commit -m "docs: 生产运维手册与部署入口"
git push
```

- [ ] **Step 4: 用户操作——确认 CI**

在浏览器打开 https://github.com/unnder83/personal-stack/actions ，确认最新一次 CI 两个 job 为绿色。

---

## M4 完成定义（DoD）

1. `https://<your-host>/` 与 `/api/health` 经 Cloudflare Tunnel 可访问。
2. 生产 compose 无任何宿主机端口发布；firewalld 仅放行 SSH。
3. HTTPS 登录正常、Cookie 带 Secure；登录限流按真实客户端 IP 分桶（伪造两个 XFF 验证互不影响）。
4. 上传下载哈希一致，容器重启后数据仍在；`/srv/stack` 数据属主正确。
5. `deploy.sh` 幂等、`rollback.sh` 可用；`docs/operations.md` 完整；CI 绿灯。

完成后进入 M5（CI/CD 自动化：GHCR 镜像、自托管 Runner、自动部署与回滚）。
