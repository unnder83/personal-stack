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
| `/opt/personal-stack/releases/<sha>` | 每个版本的不可变代码（由 Deploy 工作流下载 tarball 解出） |
| `/opt/personal-stack/current` | 指向当前版本的符号链接 |
| `/srv/stack/data/mysql` | MySQL 数据（uid 999） |
| `/srv/stack/data/files` | 网盘二进制（uid 999） |
| `/srv/stack/caddy` | Caddy 数据与配置 |

生产不发布任何宿主机端口；防火墙仅放行 SSH。公网仅经 Cloudflare Tunnel 进入。

## 2. 常用命令

```bash
# 进入生产 compose（路径随 current 切换）
COMPOSE="docker compose -p personal-stack --env-file /opt/personal-stack/.env --env-file /opt/personal-stack/current/deploy/.images -f /opt/personal-stack/current/deploy/compose.yaml"

$COMPOSE ps                          # 状态
$COMPOSE logs -f --tail=100 api      # 应用日志
$COMPOSE logs -f --tail=100 cloudflared
$COMPOSE exec -T caddy wget -qO- http://api:8000/api/health   # 内网健康检查
$COMPOSE exec mysql mysql -uroot -p"$(grep ^MYSQL_ROOT_PASSWORD= /opt/personal-stack/.env | cut -d= -f2-)" personal_stack -e "SHOW TABLES;"
```

## 3. 发布新版本（自动）

push 到 `main` 后自动完成：

1. `Release` 工作流（GitHub 云端）：构建 `ghcr.io/unnder83/personal-stack-{api,web}:<sha>` 并推送（同时打 `latest`）
2. `Deploy` 工作流（VM 自托管 Runner）：先校验该 sha 仍是 `main` 最新（防乱序部署），再经 `api.github.com` 下载 tarball 到 `/opt/personal-stack/releases/<sha>`，调用 `deploy/ops/deploy-release.sh <sha>`：
   - `docker compose pull` → 迁移 → 种子管理员 → 切换 `current` → `up -d` → 健康检查
   - 健康检查失败：自动切回上一 release 并恢复（迁移不回滚）

手动触发：Actions → Deploy → Run workflow（需已有对应 sha 的 release 镜像）。
本机手动部署（调试用）：

```bash
GHCR_USER=<你的GitHub用户名> GHCR_TOKEN=<有 read:packages 的 PAT> \
  bash deploy/ops/deploy-release.sh <sha>
```

注意：GHCR 从本机拉取较慢（有新层时约 10–13 分钟），Deploy job 已设 30 分钟超时；同一版本重跑因层已缓存会快很多。

## 4. 回滚

- 自动：健康检查失败时脚本自动回滚到上一 release（日志见 Actions → Deploy）。
- 手动：找到目标 sha 后重跑脚本（该 sha 的 release 目录与 GHCR 镜像需已存在；仅支持 M5 及之后的 release，旧 release 缺 `.images`）：

```bash
ls /opt/personal-stack/releases
GHCR_USER=<用户名> GHCR_TOKEN=<PAT> bash deploy/ops/deploy-release.sh <sha>
```

回滚只切换代码与容器，不动数据；数据库迁移保持向前兼容（可加列不可删列），必要时手工处理。

## 5. Cloudflare Tunnel 要点

- 隧道 token 在 `/opt/personal-stack/.env` 的 `CLOUDFLARE_TUNNEL_TOKEN`；轮换 token 后重跑一次部署（`Deploy` 工作流手动触发）。
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

## 9. 监控（M6）

- 栈：Prometheus（15 天/2GB 保留）+ Grafana + node-exporter；数据在 Docker 命名卷（`personal-stack_prometheus_data`/`_grafana_data`）。
- 入口：https://stack.personal-stack.ltd/grafana/ ，先过 Caddy basic auth（`viewer`），再登录 Grafana（`admin`）。两组口令在 `/opt/personal-stack/.env`（`GRAFANA_AUTH_HASH` 里的 `$` 必须写成 `$$`，否则 compose 插值会破坏哈希）。
- 抓取目标：`api`（`/metrics`）、`node`（主机）、`prometheus` 自身；`/metrics` 不经公网。
- 开关：`.env` 的 `ENABLE_MONITORING=true` 时 `deploy-release.sh` 带 `--profile monitoring`。
- cAdvisor 因 gcr.io 不可达暂缺（容器级指标延后）；如启用，需要可用的镜像源。
- 常用：查看目标 `docker compose -p personal-stack ... exec api python -c "..."`（见 deploy-notes）；Prometheus/Grafana 日志用 `logs prometheus|grafana`。

## 10. 备份与恢复（M6）

- 调度：systemd timer `personal-stack-backup.timer`，每日 03:30（`Persistent=true` 可补跑）。
- 产物：`/srv/stack/backups/db/daily/personal_stack-YYYY-MM-DD.sql.gz`（保留 7 天）与 `weekly/`（周日副本，保留 4 周）；文件镜像在 `/srv/stack/backups/files`。权限 600（仅 root）。
- 手动执行：`systemctl start personal-stack-backup.service` 或直接跑脚本。
- 恢复：`bash /opt/personal-stack/current/deploy/ops/backup/restore.sh --db <dump> [--target-db personal_stack_restore]`；文件恢复用 `--files <dir> --target <dir>`；**默认恢复到 `_restore` 库**，覆盖生产库需显式指定并输入 yes。
- 演练记录：`docs/restore-drill.md`。备份与数据同盘，不防磁盘故障；异地备份为二期。

## 11. 安全加固现状（M6）

- 已做：firewalld 仅 SSH；fail2ban（sshd jail，5 次/10 分钟封 1 小时；备份单元因 SELinux 对 rsync_t 的限制显式使用 `unconfined_service_t`）；容器 `no-new-privileges` + 上表四个服务 `cap_drop: ALL` + `read_only` + tmpfs（web 的 `/var/cache/nginx`、`/run` 设 `mode=1777`）；主站 HSTS 与 CSP（`/grafana/*` 不套 CSP）；外部镜像按 digest 固定；备份产物 600。
- 未做/暂缓：SSH 密钥化与禁 root 登录（用户决定，继续密码登录 + fail2ban）；mysql 仅 `no-new-privileges`（官方入口需要特权）；容器级指标（cAdvisor 镜像源不可达）。

## 12. 历史手工备份参考

```bash
docker compose -p personal-stack --env-file /opt/personal-stack/.env --env-file /opt/personal-stack/current/deploy/.images \
  exec -T mysql mysqldump -uroot -p"$(grep ^MYSQL_ROOT_PASSWORD= /opt/personal-stack/.env | cut -d= -f2-)" \
  --single-transaction personal_stack | gzip > /srv/stack/backups/manual-$(date +%F).sql.gz
```

（日常请用第 10 节的 systemd timer；本段仅历史参考。）
