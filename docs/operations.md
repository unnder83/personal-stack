# 运维手册（生产）

## 1. 架构与目录

```
Cloudflare 边缘 ──HTTPS──► cloudflared ──http://caddy:80──► caddy
                                                            ├─ /       → web:8080（Nginx 静态 SPA）
                                                            └─ /api/*  → api:8000（FastAPI）
                                                                          └──► mysql:3306
```

| 路径 | 用途 |
|---|---|
| `/opt/personal-stack/.env` | 生产环境变量与密钥（权限 600，不入库） |
| `/opt/personal-stack/releases/<sha>` | 每个版本的不可变代码（`git archive` 解出） |
| `/opt/personal-stack/current` | 指向当前版本的符号链接 |
| `/srv/stack/data/mysql` | MySQL 数据（uid 999） |
| `/srv/stack/data/files` | 网盘二进制（uid 999） |
| `/srv/stack/caddy` | Caddy 数据与配置 |

生产不发布任何宿主机端口；防火墙仅放行 SSH。公网仅经 Cloudflare Tunnel 进入。

## 2. 常用命令

```bash
# 进入生产 compose（路径随 current 切换）
COMPOSE="docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml"

$COMPOSE ps                          # 状态
$COMPOSE logs -f --tail=100 api      # 应用日志
$COMPOSE logs -f --tail=100 cloudflared
$COMPOSE exec -T caddy wget -qO- http://api:8000/api/health   # 内网健康检查
$COMPOSE exec mysql mysql -uroot -p"$(grep ^MYSQL_ROOT_PASSWORD= /opt/personal-stack/.env | cut -d= -f2-)" personal_stack -e "SHOW TABLES;"
```

## 3. 发布新版本

```bash
cd /root/personal-stack && git pull       # 拉取最新代码（SSH 远端）
bash deploy/ops/deploy.sh
```

脚本动作：按当前 HEAD 的 sha 建 release → 构建镜像 → `up -d` → `alembic upgrade head` → 种子管理员（幂等）→ 切换 `current`。
同一 sha 重复执行无副作用（release 已存在则跳过解压）。

## 4. 回滚

```bash
ls /opt/personal-stack/releases          # 查看可用版本
bash deploy/ops/rollback.sh <sha>
```

回滚只切换代码与容器，不动数据；数据库迁移如有不兼容需手工处理（当前各迁移均可来回）。

## 5. Cloudflare Tunnel 要点

- 隧道 token 在 `/opt/personal-stack/.env` 的 `CLOUDFLARE_TUNNEL_TOKEN`；轮换 token 后重跑 `deploy.sh`。
- 公网主机名与路由（`stack.personal-stack.ltd` → `HTTP caddy:80`）在 Cloudflare **Zero Trust → Networks → Tunnels → personal-stack → Public Hostname** 中维护。
- 隧道故障排查：`$COMPOSE logs cloudflared | grep -E "Registered|ERR"`；`1016/1034` 类错误通常是 Public Hostname/DNS 记录缺失。

## 6. 真实客户端 IP

三段配置缺一不可：cloudflared 传 `X-Forwarded-For` → Caddy `trusted_proxies static 172.28.0.0/16` → api `--proxy-headers --forwarded-allow-ips=172.28.0.0/16`。
若登录限流误伤正常用户，先检查这三处；公网回归：`HOST=stack.personal-stack.ltd bash deploy/ops/xff-check.sh`（见 `docs/deploy-notes.md`）。

## 7. 常见故障

| 现象 | 排查 |
|---|---|
| 502 Bad Gateway | `$COMPOSE ps` 看 api/web 是否健康；`$COMPOSE logs api` |
| MySQL 未就绪导致 api 重启 | healthcheck 已配 `depends_on: service_healthy`；查 `$COMPOSE logs mysql` |
| 上传 500 / 权限错误 | `/srv/stack/data/files` 属主须为 999；`chown -R 999:999 ...` |
| 公网 530/1016 | Cloudflare 主机名或隧道未连接 |
| 登录总是 429 | 真实 IP 链路退化，见第 6 节；或确有攻击 |
| 磁盘将满 | `df -h`；日志已限制 `max-size=10m,max-file=3`；备份保留策略见下一步 |

## 8. 数据备份（计划中）

备份与恢复演练是 M6 范围：`mysqldump` 日备 + 文件 rsync + systemd timer + 恢复脚本。
在此之前，手工备份方式：

```bash
mkdir -p /srv/stack/backups
docker compose --env-file /opt/personal-stack/.env -f /opt/personal-stack/current/deploy/compose.yaml \
  exec -T mysql mysqldump -uroot -p"$(grep ^MYSQL_ROOT_PASSWORD= /opt/personal-stack/.env | cut -d= -f2-)" \
  --single-transaction personal_stack | gzip > /srv/stack/backups/manual-$(date +%F).sql.gz
rsync -a /srv/stack/data/files/ /srv/stack/backups/files/
```
