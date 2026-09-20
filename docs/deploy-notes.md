# M4 上线记录

- 上线时间：2026-09-19（UTC+8 深夜）
- Release：`2298184`（`/opt/personal-stack/current`）
- 公网入口：https://stack.personal-stack.ltd （Cloudflare Tunnel → `caddy:80`）
- 生产目录：`/opt/personal-stack`（releases + current 符号链接）；数据 `/srv/stack`
- 容器：cloudflared / caddy / web / api / mysql，全部 `restart: unless-stopped`，**无宿主机端口发布**

## 验证结果

| 项目 | 结果 |
|---|---|
| `GET /api/health`（HTTPS） | 200 `{"status":"ok"}` |
| SPA 首页与深层路由（`/admin/posts`） | 200 |
| HTTPS 登录 + `/api/auth/me` | 通过；`Set-Cookie: access_token=…; HttpOnly; Secure; SameSite=lax; Max-Age=604800` |
| 真实客户端 IP 分桶 | 两段验证：① 应用腿（compose 内一次性容器伪造 XFF）：`203.0.113.7` 第 6 次 429 `rate_limited`，`203.0.113.8` 独立 401；② 公网路径（`bash deploy/ops/xff-check.sh`）：同一真实出口 IP 伪造两个 XFF 均落在同一桶（第二个伪造值仍 429），证明客户端无法借 XFF 绕过限流 |
| 1MB 上传/下载 sha256 | 一致（HASH MATCH） |
| 容器重启后数据 | 文件仍可下载，哈希一致（PERSISTED AFTER RESTART） |
| 宿主机端口 | 除 22 外无监听；firewalld 仅 `ssh` |
| 数据属主 | `/srv/stack/data/{mysql,files}` uid 999 |

## 备注

- 本机 DNS（192.168.136.2）不解析公网域名，验证时在 `/etc/hosts` 临时写入 Cloudflare 边缘 IP；不影响服务本身。
- 隧道 token 存于 `/opt/personal-stack/.env`（600，不入库）；Cloudflare 控制台中 Public Hostname 为 `stack.personal-stack.ltd` → HTTP `caddy:80`。
- 开发环境与生产环境使用不同 compose 项目名（`personal-stack-dev` / `personal-stack`），可并存。**本地冒烟/测试必须加 `-p <独立项目名>`**：曾因冒烟使用默认项目名 `personal-stack` 并执行 `down`，误删生产容器导致 502，已用上一个 release 恢复并在 compose 顶部加注释（commit `984d781`）。

## M5 自动部署与回滚演练（2026-09-20 UTC）

| 项目 | 结果 |
|---|---|
| 自动部署 #1（`fbc9866`，用户手动触发 Deploy） | 成功；`current` 切换，api/web 从 GHCR 镜像启动，mysql 数据保留 |
| 自动部署 #2（`984d781`，push 自动触发） | 成功；05:59:46 重建容器 |
| 回滚演练（`6050294` 临时把 `/api/health` 改成 500） | 按预期：拉镜像 → 迁移 → 切 `current` → `up -d` → 健康检查连续失败 → **自动回滚 `984d781`** → job 结论 Failed；公网恢复 200；坏镜像与坏 release 目录保留可追溯 |
| 恢复部署（`d8fbede`，revert 演练提交） | 成功；公网 200 |
| 部署耗时 | GHCR 拉取带宽受限：有新层时约 10–13 分钟；镜像层已在本地时 <1 分钟（已给 Deploy job 设 `timeout-minutes: 30`） |

## M5 收尾（2026-09-20 UTC）

- 自动部署第三次（`5a09d6f`，约 14 分钟，GHCR 层下载慢）与第四次（`325b469`，约 7 分钟）均成功。
- 优化：`deploy/ops/host/daemon.json` 增 `"max-concurrent-downloads": 8` 并重启 docker；容器按 restart 策略自动恢复，公网无人工介入即恢复 200。
- 结论：pull 慢的瓶颈在网络到 GHCR 的带宽，后续可评估镜像代理或构建缓存驻留方案；当前 30 分钟超时足够。
