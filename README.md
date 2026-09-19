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

## 快速开始（开发）

```bash
cp deploy/.env.example deploy/.env   # 首次
make dev-up
```

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:8000/api/health

## 常用命令

```bash
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
- 宿主机无需安装 Python / Node（开发依赖都在容器或 venv 中）
