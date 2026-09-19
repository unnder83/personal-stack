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
| 真实客户端 IP 分桶 | 伪造 XFF `203.0.113.7` 第 6 次 429 `rate_limited`；`203.0.113.8` 独立 401 |
| 1MB 上传/下载 sha256 | 一致（HASH MATCH） |
| 容器重启后数据 | 文件仍可下载，哈希一致（PERSISTED AFTER RESTART） |
| 宿主机端口 | 除 22 外无监听；firewalld 仅 `ssh` |
| 数据属主 | `/srv/stack/data/{mysql,files}` uid 999 |

## 备注

- 本机 DNS（192.168.136.2）不解析公网域名，验证时在 `/etc/hosts` 临时写入 Cloudflare 边缘 IP；不影响服务本身。
- 隧道 token 存于 `/opt/personal-stack/.env`（600，不入库）；Cloudflare 控制台中 Public Hostname 为 `stack.personal-stack.ltd` → HTTP `caddy:80`。
- 开发环境与生产环境使用不同 compose 项目名（`personal-stack-dev` / `personal-stack`），可并存。
