# 个人博客 + 个人网盘（personal-stack）设计文档

- 日期：2026-09-19
- 状态：已与项目所有者逐节确认
- 定位：学习起步、按可转为正式使用的方向设计
- 部署目标：单台 Rocky Linux 10.2 虚拟机（8 核 / 2.6G 内存 / 16G 磁盘，内网 IP 192.168.136.137，可通过端口映射对外暴露）

## 1. 背景与目标

做一个自用的「个人博客 + 个人网盘」系统，重点是**完整走一遍开发与运维（DevOps）流程**，而不是堆功能。
使用者的学习目标覆盖六项运维主题：容器化部署、反向代理与 HTTPS、CI/CD 自动化、监控与日志、数据备份、安全加固。

因此本项目的成功不只是「功能能用」，还包括「基础设施链路完整且可讲解」：代码提交后自动构建、自动部署、可回滚，有监控、有经过验证的备份。

## 2. 成功标准

1. 博客能写 Markdown、能打标签、能发布，访客免登录阅读。
2. 管理员登录后能上传、下载、重命名、移动、删除文件与文件夹，形成完整闭环。
3. 代码 push 到 `main` 后自动构建镜像并部署，部署失败能自动回滚。
4. 有 Grafana 监控大盘，有每日备份，且完成过一次真实的恢复演练。
5. 安全基线到位（防火墙、SSH 加固、HTTPS、容器非 root、密钥管理）。
6. 全部流程有文档，项目所有者能理解每一步做了什么、为什么。

## 3. 非目标（v1 明确不做）

- 多用户注册与用户间文件隔离（数据模型保留 `owner_id`，为将来留口）
- 评论、全文搜索、访问统计
- 回收站（v1 删除即物理删除）
- 断点续传、秒传、在线预览
- 对象存储（MinIO）、异地备份、告警通知、Loki 日志聚合、Playwright E2E、Trivy 扫描
  —— 以上列为二期候选，不作为 v1 验收内容

## 4. 需求澄清结论

| 问题 | 结论 |
|---|---|
| 项目定位 | 先学习，后续转正式使用；架构预留升级空间 |
| v1 范围 | 博客与网盘都做，各自最小可用 |
| 用户模型 | 单管理员账号；访客只能读已发布文章 |
| 文件存储 | 本地磁盘卷（bind mount），代码中抽象存储层以便将来切换 |
| 博客内容 | Markdown 正文 + 标签分类，无评论 |
| 前端 | React SPA（前后端分离），由 AI 主导实现 |
| 代码托管 / CI | GitHub + GitHub Actions |
| 运维学习重点 | 容器化、反代+HTTPS、CI/CD、监控日志、备份、安全加固（六项全要） |
| 网络条件 | 可做端口映射对外暴露；域名待定 |
| 前端方案 | React 18 + TypeScript + Vite + Ant Design（用户选择 SPA，非 HTMX） |

## 5. 整体架构

采用**方案 A：模块化单体**。

- 一个 FastAPI 后端进程，内部按 `auth` / `blog` / `storage` 三个模块划分，共享同一 MySQL 与鉴权。
- React SPA 独立构建为静态产物，由 Nginx 容器托管。
- Caddy 是唯一对外入口，负责 TLS、路由与限流。
- 选择理由：部署链路最简单、内存占用可控；模块边界靠代码目录约束，将来可把 `storage` 模块抽成独立服务（即方案 C 的渐进路径）。

### 5.1 容器拓扑（生产）

```
Internet ──► caddy   :80/:443   反向代理 + 自动 HTTPS + 限流
             ├─ /       ──► web  :80    Nginx 托管 React 构建产物
             └─ /api/*  ──► api  :8000  FastAPI
                              └──► mysql :3306（仅 compose 内网，不映射宿主机端口）
```

共 4 个容器：`caddy`、`web`、`api`、`mysql`。

### 5.2 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Python 3.12、FastAPI、Uvicorn、SQLAlchemy 2.0 async、Alembic、Pydantic v2、`asyncmy` 驱动 |
| 鉴权 | JWT 存 httpOnly Cookie（`HttpOnly` + `Secure` + `SameSite=Lax`），有效期 7 天，Argon2 密码哈希 |
| 数据库 | MySQL 8.0（utf8mb4） |
| 前端 | React 18 + TypeScript + Vite + React Router + TanStack Query + Tailwind CSS + Ant Design |
| Markdown | 编辑器 `@uiw/react-md-editor`，渲染 `react-markdown` + 代码高亮 |
| 反向代理 | Caddy 2（自动 HTTPS） |
| 容器化 | Docker + Docker Compose |
| 镜像仓库 | GHCR（GitHub Container Registry） |

## 6. 代码结构与模块边界

```
personal-stack/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 装配、中间件、异常处理
│   │   ├── core/                # config / security / logging / deps
│   │   ├── db/                  # engine、session、Base
│   │   └── modules/
│   │       ├── auth/            # 登录、当前用户、密码
│   │       ├── blog/            # 文章、标签
│   │       └── storage/         # 文件夹、文件、上传下载
│   ├── alembic/                 # 数据库迁移
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                 # HTTP 客户端与类型
│   │   ├── pages/               # blog / drive / admin / login
│   │   ├── components/
│   │   ├── layouts/
│   │   └── main.tsx
│   ├── nginx.conf               # SPA history 回退 + /api 内转
│   ├── Dockerfile               # 多阶段：node 构建 → nginx 托管
│   └── package.json
├── deploy/
│   ├── compose.yaml             # 生产编排
│   ├── compose.dev.yaml         # 开发覆盖（热重载、暴露端口）
│   ├── Caddyfile
│   ├── .env.example             # 密钥模板（真 .env 不入库）
│   └── ops/                     # 备份脚本、监控配置、Runner、smoke test
├── .github/workflows/           # CI / Release / Deploy
└── docs/superpowers/            # 本设计文档与实施计划
```

**模块边界规则**（将来能拆服务的关键）

- 每个模块结构统一：`models.py`（表）、`schemas.py`（入出参）、`service.py`（业务逻辑）、`router.py`（HTTP 层）。
- 模块间只允许通过对方 `service.py` 暴露的函数调用；禁止 import 对方的 `models` 或直接查询对方的表。
- `core`、`db` 为共享基础设施，所有模块可依赖。
- 例：`storage` 需要「当前用户」时只从 `auth` 的 service 获取，绝不自行查询 `users` 表。

## 7. 数据模型

共 6 张表：

| 表 | 关键字段 | 约束/说明 |
|---|---|---|
| `users` | username、password_hash、is_active、created_at、updated_at | username 唯一；单管理员但结构支持多用户 |
| `posts` | title、slug、summary、content_md、status(draft/published)、published_at、created_at、updated_at | slug 唯一；正文存 Markdown 原文 |
| `tags` | name、slug | 均唯一 |
| `post_tags` | post_id、tag_id | 联合主键，多对多 |
| `folders` | owner_id、parent_id（自引用）、name、created_at、updated_at | 唯一约束 (owner_id, parent_id, name) |
| `files` | owner_id、folder_id、name、storage_path、size、mime_type、sha256、created_at、updated_at | 唯一约束 (owner_id, folder_id, name)；索引 folder_id |

约定：

- 时间统一以 UTC 存储，前端展示时转换本地时区；对外 ISO 8601 字符串。
- `storage_path` 形如 `files/1/a3/a3f9....bin`（按 sha256 前两位分桶，避免单目录文件过多）。
- 删除为物理删除；同名冲突返回 409 由前端提示。
- 上传文件名不可信，落盘使用服务端生成的哈希路径，展示与下载另存数据库中的原始文件名。

## 8. API 设计

统一前缀 `/api`。

```
# 认证
POST   /api/auth/login            登录，下发 httpOnly Cookie
POST   /api/auth/logout           注销
GET    /api/auth/me               当前用户

# 博客（公开，仅返回已发布）
GET    /api/posts                 ?tag=&page=&page_size=
GET    /api/posts/{slug}
GET    /api/tags

# 博客管理（需登录）
GET    /api/admin/posts           ?status=
POST   /api/admin/posts
PUT    /api/admin/posts/{id}
DELETE /api/admin/posts/{id}

# 网盘（需登录）
GET    /api/folders               ?parent_id=  列出目录内容（文件夹+文件）
POST   /api/folders               新建文件夹
PATCH  /api/folders/{id}          重命名 / 移动
DELETE /api/folders/{id}          非空返回 409；?recursive=true 递归删除
POST   /api/files/upload          multipart，字段 folder_id
GET    /api/files/{id}/download   流式下载，Content-Disposition
PATCH  /api/files/{id}            重命名 / 移动
DELETE /api/files/{id}
GET    /api/storage/usage         已用空间统计
```

统一约定：

- 列表响应 `{items, total, page, page_size}`，`page` 默认 1，`page_size` 默认 20、上限 100；错误响应 `{code, message}` 配语义化 HTTP 状态码（401/403/404/409/413/422）。
- 登录限流：同一 IP 每分钟最多 5 次失败尝试，超出返回 429。
- 上传单文件默认上限 2 GB，可配置；超限返回 413。文件流式写入磁盘，不在内存聚合。
- ID 使用自增整数对外暴露。

## 9. 部署架构

### 9.1 开发环境（VM 本机）

`deploy/compose.dev.yaml`：

- `api` 挂载源码并开启热重载
- MySQL 暴露 3306 便于调试
- 前端运行 Vite dev server（5173）
- 不启动 caddy / web

日常命令：`docker compose -f deploy/compose.dev.yaml up`

### 9.2 生产目录布局（VM 上）

```
/opt/personal-stack/
  current -> releases/<git-sha>/     # 符号链接，指向当前版本
  releases/<git-sha>/                # compose.yaml、Caddyfile、ops/
  .env                               # 密钥，权限 600，不入库
/srv/stack/
  data/mysql/      # 数据库文件（bind mount）
  data/files/      # 网盘二进制（bind mount 进 api）
  caddy/           # 证书与 Caddy 数据
  backups/         # 备份输出
```

### 9.3 资源预算

- 应用 + 数据库常驻约 600–800 MB。
- 主机 2.6 GB 内存、2 GB swap；监控栈分期上线，避免 OOM。
- 磁盘可用约 14 GB：其中系统与镜像/数据卷之外，网盘实际可用容量需在 M6 前确认并写入文档（预计 ≤ 10 GB）。
- 所有容器日志开启轮转：`max-size=10m`、`max-file=3`。
- 备份保留策略：7 天日备 + 4 周周备，避免备份吃满磁盘。

## 10. CI/CD

### 10.1 网络约束与对策

实测结果（VM 到 GitHub 相关端点）：

| 目标 | 结果 |
|---|---|
| `github.com`（网页与 git clone） | 不可达（超时） |
| `api.github.com` | 可达（200） |
| `codeload.github.com` | 可达 |
| `ghcr.io` | 可达 |
| `pipelines/broker/results-receiver.actions.githubusercontent.com` | 可达 |

对策：CD **不使用 `actions/checkout`**，改为通过 `api.github.com` 下载指定 commit 的 tarball 解压部署。若自托管 Runner 后续不可用，兜底方案为 VM 上 systemd timer 轮询 GHCR 镜像摘要，发现更新即 `pull + up`。

### 10.2 CI（GitHub 云端 Runner：push / PR）

1. 后端：`ruff` → `pytest`（MySQL service container 跑真实数据库测试）
2. 前端：`tsc` 类型检查 → `eslint` → `vitest` → `vite build`
3. 任一失败即红灯，禁止合并

### 10.3 Release（push 到 main）

构建 `api`、`web` 镜像，打 `sha` 与 `latest` 双标签，推送 GHCR。

### 10.4 Deploy（自托管 Runner 跑在 VM 上，主动出站领取任务）

1. 通过 `api.github.com` 下载该 commit tarball，解压到 `releases/<sha>/`
2. `docker login ghcr.io`
3. `docker compose -f releases/<sha>/compose.yaml pull`
4. 运行一次性容器执行 `alembic upgrade head`
5. 切换 `current` 符号链接
6. `docker compose up -d`
7. 健康检查：内网请求 `/api/health`；失败则切回上一个 release 并用旧镜像重启（自动回滚）

## 11. 运维

### 11.1 监控与日志（分期）

- **一期（约 400–500 MB）**：Prometheus + Grafana + node_exporter（主机）+ cAdvisor（容器）；API 暴露 `/metrics`。
- **二期**：Loki + Promtail 聚合容器日志；Grafana 统一查询；告警通知（邮件/Webhook）。
- 日志基础保障不等待二期：所有容器 Docker 日志轮转（见 9.3）。
- Grafana 大盘：主机 CPU/内存/磁盘、容器资源、API 延迟与错误率。

### 11.2 备份与恢复

- MySQL：每日 `mysqldump --single-transaction | gzip`，保留 7 天日备 + 4 周周备。
- 文件：`rsync` 增量备份到 `/srv/stack/backups/files`。
- 调度：宿主层 **systemd timer**（不使用容器内 cron，本身作为运维知识点）。
- 必须提供 `restore.sh` 并完成一次真实恢复演练；未验证可恢复的备份视为无效备份。演练记录存入 `docs/`。
- 注意：v1 备份与数据同盘，仅防误删/损坏，不防磁盘故障；异地备份（restic 推对象存储）为二期内容，已在风险表中记录。

### 11.3 安全加固

- `firewalld` 仅放行 22 / 80 / 443；MySQL 不暴露；开发端口仅局域网可达。
- SSH：禁用密码登录仅公钥；部署 `fail2ban`。
- 密钥：`.env` 权限 600 且不入库，仓库仅保留 `.env.example`。
- 容器：镜像内非 root 用户运行、可只读则只读根文件系统、`cap_drop: ALL`。
- 应用：登录接口限流；Cookie 配置 `HttpOnly + Secure + SameSite`；上传做 MIME/扩展名校验；文件按哈希命名防路径穿越；Caddy/Nginx 配置安全响应头与 CSP。

### 11.4 HTTPS 节奏

- 域名与端口映射就绪前：局域网以 HTTP/自签证书完成功能闭环。
- 映射就绪后：Caddy 自动申请 Let's Encrypt 证书，改少量配置即可切换。
- 上线前置条件（M4 开始前需提供）：一个域名、80/443 端口映射到本机。

## 12. 测试策略

- 后端：`pytest` + `httpx` ASGI 直连（不监听端口），连接真实 MySQL（Alembic 建表），按 TDD 先写失败测试。覆盖认证、博客 CRUD、目录树、上传下载、越权访问。
- 前端：`Vitest` + React Testing Library 覆盖关键组件（登录、文章编辑器、文件列表）；API 以 MSW 打桩。
- 端到端：v1 用 `ops/smoke-test.sh`（健康检查 + 登录 + 上传下载回环）作为部署门禁；Playwright 列二期。
- 运维验证：备份后执行恢复演练并记录结果。

## 13. 里程碑

每个里程碑结束条件：测试全绿且可部署。

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| M0 骨架 | 安装 Docker、仓库结构、开发编排、`/api/health`、CI 首次绿灯 | `compose.dev up` 后健康检查可访问 |
| M1 认证 | 登录/注销/当前用户、Cookie JWT、登录限流 | 测试覆盖登录成功/失败/未授权 |
| M2 博客 | 文章+标签 CRUD、公开列表/详情、后台编辑器 | 能写 Markdown、打标签、访客可读 |
| M3 网盘 | 目录树、上传/下载/重命名/移动/删除、用量统计 | 浏览器上传 100MB 文件并下载，哈希一致 |
| M4 生产部署 | Caddy + 生产编排 + 域名/HTTPS + 首次手动上线 | 外网 HTTPS 可访问 |
| M5 CI/CD | 镜像推 GHCR、自托管 Runner、自动部署与回滚 | push 后自动上线；人工制造健康检查失败能自动回滚 |
| M6 运维一期 | 监控大盘、每日备份 + 恢复演练、安全加固 | Grafana 有数据；从备份成功恢复一次 |

## 14. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| `github.com` 不可达 | checkout/自动部署失败 | 用 `api.github.com` tarball 绕行；Runner 端点已实测可达；保留轮询兜底方案 |
| 内存仅 2.6 GB | 监控栈上线后 OOM | 监控分期；已配置 2 GB swap；上线后据 Grafana 数据调整 |
| 磁盘仅 16 GB | 备份/日志/网盘写满根分区 | 日志轮转、备份保留策略、磁盘用量纳入监控告警 |
| 域名/映射未就绪 | M4 阻塞 | 先内网 HTTP 闭环；域名与 80/443 作为 M4 前置条件在计划中显式列出 |
| 单文件过大 | 上传时占用内存/磁盘 | 2 GB 上限、流式写入、413 明确提示 |
| 前端零基础 | 学习曲线 | 由 AI 主导前端实现，文档解释结构；先保证可运行再逐步理解 |
