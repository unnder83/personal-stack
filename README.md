# personal-stack

个人博客 + 个人网盘。部署在单台 Rocky Linux 虚拟机上，重点练习开发与运维全流程。

- 设计文档：`docs/superpowers/specs/2026-09-19-personal-stack-design.md`
- 实施计划：`docs/superpowers/plans/`

## 目录

| 目录 | 说明 |
|---|---|
| `backend/` | FastAPI 后端（auth / blog / storage 模块） |
| `frontend/` | React + TypeScript + Vite 前端 |
| `deploy/` | Compose 编排、Caddyfile、运维脚本 |
| `docs/` | 设计文档与实施计划 |

## 生产部署

- 入口：https://stack.personal-stack.ltd （Cloudflare Tunnel，无公网端口）
- 部署：`deploy/ops/deploy.sh`；回滚：`deploy/ops/rollback.sh <sha>`
- 运维手册：`docs/operations.md`；上线记录：`docs/deploy-notes.md`

## 快速开始（开发）

```bash
cp deploy/.env.example deploy/.env   # 首次
make setup-backend                   # 首次：创建后端 venv 并安装依赖
make dev-up                          # 启动 mysql + api + web
make migrate                         # 首次：执行数据库迁移
make seed-admin                      # 首次：创建管理员（读取 deploy/.env 中的 ADMIN_*）
```

开发管理员账号来自 `deploy/.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`（默认 `admin` / `dev-admin-password`，请自行修改）。

- 前端：http://localhost:5173 （登录页 `/login`）
- 博客首页：http://localhost:5173 （文章列表、标签过滤、文章详情 `/posts/<slug>`）
- 管理后台：http://localhost:5173/admin/posts （需登录；文章增删改、Markdown 编辑器）
- 网盘：http://localhost:5173/drive （需登录；开发环境文件存放在仓库 `data/files/`，已 git 忽略，`make dev-up` 会自动准备目录）
- 后端健康检查：http://localhost:8000/api/health

## 常用命令

```bash
make setup-backend   # 首次：创建 backend/.venv 并安装依赖
make db-up           # 只启动 MySQL（测试需要）
make migrate         # 执行数据库迁移
make seed-admin      # 创建/确认管理员账号（幂等）
make dev-up          # 启动开发环境
make dev-down        # 停止
make dev-logs        # 跟踪日志
make test-backend    # 后端测试
make check-backend   # 后端 lint + 测试
make check-frontend  # 前端类型检查 + lint + 测试
```

## 环境要求

- Docker CE + Compose v2（安装脚本：`deploy/ops/host/install-docker.sh`）
- GNU Make（Rocky：`dnf install -y make`）
- 宿主机 Python 仅用于创建后端测试 venv（`make setup-backend`）；前端依赖都在容器中，无需安装 Node
