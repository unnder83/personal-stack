# M0 骨架与基础设施 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在虚拟机上装好 Docker 与镜像加速，搭起 `backend`（FastAPI + `/api/health`）、`frontend`（React + Vite + 健康状态页）与开发编排，代码推到 GitHub 并让 CI 首次绿灯。

**Architecture:** 模块化单体的第一步：只建立仓库骨架、最小后端、最小前端和开发用 Docker Compose。生产编排、Caddy、CI/CD 发布流程在 M4/M5 计划中实现。

**Tech Stack:** Python 3.12 + FastAPI + Uvicorn / React 18 + TypeScript + Vite + Vitest / Docker CE + Compose v2 / MySQL 8.0（M0 仅起容器，M1 接入） / GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-19-personal-stack-design.md`

## Global Constraints

- 所有命令在仓库根目录 `/root/personal-stack` 下执行（除注明外）。
- 后端 Python 3.12；依赖版本按本计划钉死；host venv 位于 `backend/.venv`（已 gitignore）。
- 前端 React 18 + TypeScript + Vite；Node 通过 `node:22-alpine` 容器运行，**不在宿主机安装 Node**。
- Docker Hub 不可达：必须配置镜像加速（Task 1），基础镜像拉取走加速器。
- `github.com` HTTPS 不可达：git 远端必须用 SSH（Task 7 的 `~/.ssh/config` 走 `ssh.github.com:443`）。
- 容器内应用以非 root 用户运行；Docker 日志轮转 `max-size=10m`、`max-file=3`（Task 1 的 daemon.json）。
- 密钥只放在 `deploy/.env`（权限 600，不入库）；仓库中只保留 `deploy/.env.example`。
- API 统一前缀 `/api`；M0 唯一端点 `GET /api/health` 返回 `{"status":"ok"}`。
- 时区约定 UTC（M1 起在数据层落实，本计划不涉及）。
- 提交信息使用中文 conventional commits 风格（`feat:` / `chore:` / `ci:` / `docs:`）。

## 环境实测结论（写计划时已验证）

| 检查项 | 结果 |
|---|---|
| `download.docker.com/linux/rhel/10/...` | 可达（用 rhel 仓库，不要用 centos） |
| `registry-1.docker.io` | **不可达**，必须配镜像加速 |
| 可用加速器 | `docker.m.daocloud.io`、`docker.1panel.live`、`docker.nju.edu.cn` |
| PyPI / npm registry | 可达 |
| `ghcr.io` | 可达 |
| `github.com` HTTPS / git-clone | 不可达 |
| `github.com:22`、`ssh.github.com:443` | 可达 |
| `dnf-plugins-core` | 已安装 |
| `python3 -m venv` | 可用（自带 pip 23.3.2），无需装 python3-pip |

## Review Focus

以下五类输入/失败模式在规格中被隐含，但不一定被单测覆盖；每个都在对应任务里钉了验证步骤。

1. **镜像加速器失效或缺少镜像** → 任何 `docker build/pull` 直接失败：Task 1 必须真实拉取 `mysql:8.0` 与 `python:3.12-slim` 各起一次容器。
2. **前端容器用 `localhost` 访问 API** → 容器内解析到自身而非 `api` 服务：Task 6 必须用 `curl http://localhost:5173/api/health`（走 Vite 代理）验证。
3. **`deploy/.env` 缺失** → compose 变量插值为空、MySQL 初始化失败：Task 6 先复制 `.env` 再用 `docker compose config` 断言变量已注入。
4. **非 root 容器遇到 bind mount** → 将来上传/迁移写盘权限失败：Task 4 验证容器内 uid 非 0；Task 6 验证 api 容器进程用户。
5. **MySQL 未就绪时 API 先启动** → 连接被拒、容器反复重启：Task 6 用 `depends_on: service_healthy` + healthcheck 验证，且 `docker compose ps` 中 mysql 为 healthy 后 api 才 Running。

---

### Task 1: 安装 Docker CE 并配置镜像加速与日志轮转

**Files:**
- Create: `deploy/ops/host/daemon.json`
- Create: `/etc/docker/daemon.json`（宿主机系统文件，从仓库文件复制）
- Create: `deploy/ops/host/install-docker.sh`（把安装过程脚本化，便于重装/换机）

**Interfaces:**
- Consumes: 无
- Produces: 可用的 `docker`、`docker compose`；`/etc/docker/daemon.json` 中已配置 registry-mirrors 与日志轮转，供本计划后续所有任务使用。

- [ ] **Step 1: 写 daemon.json 到仓库**

`deploy/ops/host/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live",
    "https://docker.nju.edu.cn"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

- [ ] **Step 2: 写安装脚本到仓库**

`deploy/ops/host/install-docker.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  echo "docker 已安装：$(docker --version)"
else
  dnf install -y dnf-plugins-core
  # Rocky 10 使用 RHEL 10 仓库（实测可达），不要用 centos 路径
  dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

mkdir -p /etc/docker
cp "$(dirname "$0")/daemon.json" /etc/docker/daemon.json

systemctl enable --now docker
systemctl restart docker
```

执行 `chmod +x deploy/ops/host/install-docker.sh`。

- [ ] **Step 3: 执行安装脚本**

```bash
bash deploy/ops/host/install-docker.sh
```

预期：脚本无报错结束。

- [ ] **Step 4: 验证 Docker 与 Compose 可用**

```bash
docker --version
docker compose version
```

预期：两条命令都输出版本号；`docker compose version` 形如 `Docker Compose version v2.x`。

- [ ] **Step 5: 验证镜像加速真实生效（拉 Docker Hub 镜像）**

```bash
docker pull mysql:8.0
docker pull python:3.12-slim
```

预期：两个镜像都成功拉取。
若失败，逐个尝试镜像直连前缀并打回标准标签：

```bash
docker pull docker.m.daocloud.io/library/mysql:8.0
docker tag docker.m.daocloud.io/library/mysql:8.0 mysql:8.0
```

并把可用的加速器顺序调整到 `deploy/ops/host/daemon.json` 的最前面，重新执行 Step 3。

- [ ] **Step 6: 验证容器能运行且日志轮转配置生效**

```bash
docker run --rm mysql:8.0 mysql --version
docker run --rm python:3.12-slim python --version
docker info --format '{{json .LoggingDriver}}'
docker info | grep -A4 "Registry Mirrors"
```

预期：MySQL 与 Python 版本号正常输出；LoggingDriver 为 `json-file`；Registry Mirrors 下有已配置的加速器地址。

- [ ] **Step 7: 提交**

```bash
git add deploy/ops/host
git commit -m "chore: 添加 Docker 安装脚本与镜像加速/日志轮转配置"
```

---

### Task 2: 仓库骨架（README、env 模板、Makefile、gitignore）

**Files:**
- Create: `README.md`
- Create: `deploy/.env.example`
- Create: `Makefile`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 的 Docker 环境。
- Produces: `deploy/.env.example`（Task 6 复制为 `deploy/.env`）；`Makefile` 目标名（`dev-up` / `dev-down` / `dev-logs` / `test-backend` / `lint-backend` / `test-frontend` / `build-frontend` / `check-frontend`）供后续任务与日常开发使用。

- [ ] **Step 1: 补全 .gitignore**

`.gitignore` 内容改为：

```gitignore
# 环境与密钥
.env
deploy/.env

# Python
__pycache__/
*.py[cod]
.venv/
.pytest_cache/
.ruff_cache/
.coverage

# Node
node_modules/
dist/

# 编辑器
.vscode/
.idea/
```

- [ ] **Step 2: 写 env 模板**

`deploy/.env.example`：

```dotenv
# ===== 开发环境（compose.dev.yaml）=====
MYSQL_ROOT_PASSWORD=dev-root-password
MYSQL_DATABASE=personal_stack
MYSQL_USER=app
MYSQL_PASSWORD=dev-app-password
SECRET_KEY=dev-secret-change-me
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dev-admin-password
MAX_UPLOAD_SIZE_MB=2048

# ===== 生产环境（M4 起使用）=====
# DOMAIN=your-domain.example.com
```

- [ ] **Step 3: 写 Makefile**

```makefile
DEV_COMPOSE := docker compose -f deploy/compose.dev.yaml

.PHONY: dev-up dev-down dev-logs dev-ps test-backend lint-backend check-backend test-frontend build-frontend check-frontend

dev-up:
	$(DEV_COMPOSE) up -d --build

dev-down:
	$(DEV_COMPOSE) down

dev-logs:
	$(DEV_COMPOSE) logs -f --tail=100

dev-ps:
	$(DEV_COMPOSE) ps

test-backend:
	cd backend && .venv/bin/python -m pytest -v

lint-backend:
	cd backend && .venv/bin/ruff check .

check-backend: lint-backend test-backend

test-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine npm test -- --run

build-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine npm run build

check-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run"
```

- [ ] **Step 4: 写 README**

`README.md`：

```markdown
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
- 宿主机无需安装 Python / Node（开发依赖都在容器或 venv 中）
```

- [ ] **Step 5: 验证骨架文件齐全**

```bash
ls README.md Makefile deploy/.env.example
make -n dev-up
make -n check-backend
```

预期：文件都存在；`make -n` 能正常打印命令而不报错（`make -n` 只打印不执行，因此 compose 文件与 venv 尚不存在也没关系）。

- [ ] **Step 6: 验证 .env 不会被误提交**

```bash
cp deploy/.env.example deploy/.env
git status --porcelain
```

预期：`git status --porcelain` 输出中**没有** `deploy/.env`（被忽略），且能看到 `README.md`、`Makefile`、`deploy/.env.example` 等新增文件。

- [ ] **Step 7: 提交**

```bash
git add .gitignore README.md Makefile deploy/.env.example
git commit -m "chore: 搭建仓库骨架与开发命令入口"
```

---

### Task 3: 后端最小应用与健康检查（TDD）

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

**Interfaces:**
- Consumes: Task 1 的 Docker（本任务测试在 host venv 中跑，不依赖 Docker）。
- Produces:
  - `app.core.config.Settings`（pydantic-settings 类，字段 `app_name`、`secret_key`、`database_url`、`cors_origins`、`max_upload_size_mb`）与模块级单例 `settings`
  - `app.main.app`（FastAPI 实例）
  - `GET /api/health` → `{"status": "ok"}`
  - pytest fixtures：`client: httpx.AsyncClient`（ASGI 直连）

- [ ] **Step 1: 创建后端依赖清单**

`backend/requirements.txt`：

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.4
pydantic-settings==2.7.0
sqlalchemy[asyncio]==2.0.36
asyncmy==0.2.10
alembic==1.14.0
PyJWT==2.10.1
argon2-cffi==23.1.0
```

`backend/requirements-dev.txt`：

```text
-r requirements.txt
pytest==8.3.4
pytest-asyncio==0.25.1
httpx==0.28.1
ruff==0.8.6
```

- [ ] **Step 2: 创建 pytest 与 ruff 配置**

`backend/pyproject.toml`：

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "ASYNC"]
```

- [ ] **Step 3: 创建 venv 并安装依赖**

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements-dev.txt
```

预期：安装成功，无编译错误（`asyncmy`、`argon2-cffi` 均有 wheel）。

- [ ] **Step 4: 先写失败的测试**

`backend/tests/test_health.py`：

```python
async def test_health_returns_ok(client):
    response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

`backend/tests/conftest.py`：

```python
import httpx
import pytest
from httpx import ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 5: 运行测试确认失败**

```bash
cd backend
.venv/bin/python -m pytest tests/test_health.py -v
```

预期：FAIL，报 `ModuleNotFoundError: No module named 'app'`（或找不到 `app.main`）。

- [ ] **Step 6: 写最小实现**

`backend/app/__init__.py`：空文件。
`backend/app/core/__init__.py`：空文件。

`backend/app/core/config.py`：

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "personal-stack"
    secret_key: str = "dev-secret-change-me"
    database_url: str = "mysql+asyncmy://app:dev-app-password@mysql:3306/personal_stack"
    cors_origins: str = "http://localhost:5173"
    max_upload_size_mb: int = 2048


settings = Settings()
```

`backend/app/main.py`：

```python
from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(title=settings.app_name)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: 运行测试确认通过**

```bash
cd backend
.venv/bin/python -m pytest -v
```

预期：`1 passed`。

- [ ] **Step 8: 运行 lint**

```bash
cd backend
.venv/bin/ruff check .
```

预期：`All checks passed!`

- [ ] **Step 9: 提交**

```bash
git add backend
git commit -m "feat: 后端最小应用与 /api/health（含 pytest 骨架）"
```

---

### Task 4: 后端 Dockerfile（非 root、含健康检查）

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consumes: Task 3 的 `backend/app`、`backend/requirements.txt`。
- Produces: 镜像 `personal-stack-api:dev`，容器内监听 `8000`，运行用户非 root，自带 `HEALTHCHECK`（访问 `/api/health`）；Task 6 的开发编排与 M4 的生产编排都基于它构建。

- [ ] **Step 1: 写 .dockerignore**

`backend/.dockerignore`：

```text
.venv/
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
tests/
```

- [ ] **Step 2: 写 Dockerfile**

`backend/Dockerfile`：

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY --chown=app:app app ./app

USER app

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: 构建镜像**

```bash
docker build -t personal-stack-api:dev backend
```

预期：构建成功。

- [ ] **Step 4: 运行容器并验证健康检查**

```bash
docker run -d --rm -p 8000:8000 --name api-test personal-stack-api:dev
sleep 3
curl -sf http://localhost:8000/api/health
```

预期：输出 `{"status":"ok"}`。

- [ ] **Step 5: 验证非 root 用户**

```bash
docker exec api-test id -u
docker exec api-test id -un
```

预期：uid 不为 `0`，用户名为 `app`。

- [ ] **Step 6: 验证镜像内置 HEALTHCHECK 生效**

```bash
sleep 7
docker inspect --format '{{.State.Health.Status}}' api-test
```

预期：输出 `healthy`。

- [ ] **Step 7: 清理**

```bash
docker stop api-test
```

- [ ] **Step 8: 提交**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat: 后端镜像（非 root + 内置健康检查）"
```

---

### Task 5: 前端骨架（Vite + React + TS + Vitest）

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/eslint.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`
- Create（生成）: `frontend/package-lock.json`

**Interfaces:**
- Consumes: Task 1 的 Docker（Node 通过 `node:22-alpine` 容器执行）。
- Produces:
  - 可构建的 React 应用，开发服务器监听 `5173`，`/api` 请求代理到 `http://api:8000`（供 Task 6 在 compose 网络内验证）
  - `App` 组件：挂载后请求 `/api/health` 并显示 `后端状态：API 正常 / API 异常 / API 不可达`
  - 前端命令：`npm run dev` / `build` / `test` / `lint`；`package-lock.json` 供 CI `npm ci` 使用

- [ ] **Step 1: 写 package.json**

`frontend/package.json`：

```json
{
  "name": "personal-stack-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.14.0",
    "jsdom": "^25.0.1",
    "typescript": "~5.7.2",
    "typescript-eslint": "^8.19.0",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写 Vite 配置（含 /api 代理与 Vitest）**

`frontend/vite.config.ts`：

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

注意：代理目标是 compose 服务名 `api`；宿主机浏览器通过 `localhost:5173` 访问时由 Vite 容器转发。

- [ ] **Step 3: 写 TypeScript 与 ESLint 配置**

`frontend/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`frontend/eslint.config.js`：

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

- [ ] **Step 4: 安装依赖**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm install
```

预期：安装成功并生成 `frontend/package-lock.json`。

- [ ] **Step 5: 先写失败的测试**

`frontend/src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
```

`frontend/src/App.test.tsx`：

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('健康检查成功时显示 API 正常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok' }),
      }),
    )

    render(<App />)

    expect(screen.getByText('后端状态：检测中...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('后端状态：API 正常')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 6: 运行测试确认失败**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run
```

预期：FAIL，报错无法解析 `./App`（`App.tsx` 尚不存在）。

- [ ] **Step 7: 写最小实现**

`frontend/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>personal-stack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`：

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`frontend/src/App.tsx`：

```tsx
import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('检测中...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status === 'ok' ? 'API 正常' : 'API 异常'))
      .catch(() => setStatus('API 不可达'))
  }, [])

  return (
    <main>
      <h1>personal-stack</h1>
      <p>后端状态：{status}</p>
    </main>
  )
}
```

- [ ] **Step 8: 运行测试确认通过**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run
```

预期：`1 passed`。

- [ ] **Step 9: 类型检查、lint、构建**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm run build"
```

预期：三项全部成功，生成 `frontend/dist/`。

- [ ] **Step 10: 提交**

```bash
git add frontend
git commit -m "feat: 前端骨架（Vite + React + TS + Vitest + 健康状态页）"
```

---

### Task 6: 开发编排 compose.dev.yaml

**Files:**
- Create: `deploy/compose.dev.yaml`
- Modify: `Makefile`（若 Task 2 的目标名与实际不符则修正）
- Local（不入库）: `deploy/.env`

**Interfaces:**
- Consumes: Task 4 的 `backend/Dockerfile`、Task 5 的前端工程、Task 2 的 `deploy/.env.example`。
- Produces: 一条命令起 `mysql` + `api` + `web` 三个开发服务；网络内服务名 `mysql`、`api`、`web`；宿主端口 `3306`、`8000`、`5173`。

- [ ] **Step 1: 确保 deploy/.env 存在**

```bash
test -f deploy/.env || cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

- [ ] **Step 2: 写 compose.dev.yaml**

`deploy/compose.dev.yaml`：

```yaml
name: personal-stack-dev

services:
  mysql:
    image: mysql:8.0
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 30s

  api:
    build:
      context: ../backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: mysql+asyncmy://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      SECRET_KEY: ${SECRET_KEY}
      MAX_UPLOAD_SIZE_MB: ${MAX_UPLOAD_SIZE_MB}
    ports:
      - "8000:8000"
    volumes:
      - ../backend/app:/app/app
    depends_on:
      mysql:
        condition: service_healthy

  web:
    image: node:22-alpine
    working_dir: /app
    command: sh -c "npm install && npm run dev"
    ports:
      - "5173:5173"
    volumes:
      - ../frontend:/app
    depends_on:
      - api

volumes:
  mysql_data:
```

- [ ] **Step 3: 验证变量注入正确**

```bash
docker compose -f deploy/compose.dev.yaml config | grep -E "MYSQL_DATABASE|DATABASE_URL" | head -5
```

预期：输出中包含真实值 `personal_stack` 与 `mysql+asyncmy://app:dev-app-password@mysql:3306/personal_stack`，而非空值或 `${...}` 字面量。

- [ ] **Step 4: 启动并等待就绪**

```bash
docker compose -f deploy/compose.dev.yaml up -d --build
docker compose -f deploy/compose.dev.yaml ps
```

预期：`mysql` 最终为 `healthy`，`api` 在 mysql healthy 后才变为 Running。

- [ ] **Step 5: 验证后端健康检查**

```bash
sleep 5
curl -sf http://localhost:8000/api/health
```

预期：`{"status":"ok"}`。

- [ ] **Step 6: 验证前端与 API 代理链路（浏览器真实路径）**

```bash
curl -sf http://localhost:5173/api/health
curl -s http://localhost:5173 | grep -q "personal-stack" && echo "前端页面 OK"
```

预期：第一行输出 `{"status":"ok"}`（证明 Vite 容器内用服务名 `api` 转发成功）；第二行输出 `前端页面 OK`。
说明：首次启动 `web` 容器要先 `npm install`，若 5173 暂不通，等待 30–60 秒重试。

- [ ] **Step 7: 验证非 root 与网络隔离**

```bash
docker compose -f deploy/compose.dev.yaml exec api id -un
docker compose -f deploy/compose.dev.yaml exec web id -un
```

预期：`api` 输出 `app`；`web` 输出 `root`（node 官方镜像默认，开发环境可接受；生产 `web` 镜像在 M4 计划中改为非 root）。

- [ ] **Step 8: 停止开发环境**

```bash
docker compose -f deploy/compose.dev.yaml down
```

预期：容器全部停止；`mysql_data` 卷保留（再次 `up` 数据还在）。

- [ ] **Step 9: 提交**

```bash
git add deploy/compose.dev.yaml Makefile
git commit -m "feat: 开发环境编排（mysql + api 热重载 + vite dev server）"
```

---

### Task 7: GitHub 仓库与 SSH 远端

**Files:**
- Create: `/root/.ssh/config`（宿主机系统文件，不入库）
- Create: `/root/.ssh/id_ed25519` + `.pub`
- Modify: git remote（`git remote add origin`）

**Interfaces:**
- Consumes: Task 2–6 的所有提交（在本地 `main` 分支上）。
- Produces: `origin` 远端指向 `git@github.com:<GITHUB_USER>/personal-stack.git`，`main` 已推送；Task 8 的 CI 依赖它触发。

- [ ] **Step 1: 生成专用的部署/推送密钥**

```bash
test -f /root/.ssh/id_ed25519 || ssh-keygen -t ed25519 -C "personal-stack-vm" -f /root/.ssh/id_ed25519 -N ""
cat /root/.ssh/id_ed25519.pub
```

预期：打印出公钥内容。

- [ ] **Step 2: 用户操作——创建 GitHub 仓库并添加公钥（需要你动手）**

在浏览器中（用你自己的电脑）完成：

1. 打开 https://github.com/new ，创建 **Private** 仓库 `personal-stack`，**不要**勾选 README / .gitignore / license。
2. 进入仓库 → Settings → Deploy keys → Add deploy key：
   - Title: `personal-stack-vm`
   - Key: 粘贴 Step 1 打印的公钥
   - **勾选 Allow write access**
3. 告诉我你的 GitHub 用户名，用于下一步配置 remote。

- [ ] **Step 3: 配置 SSH 走 443（绕过 github.com:22 被限的风险）**

`/root/.ssh/config`：

```sshconfig
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile /root/.ssh/id_ed25519
  IdentitiesOnly yes
```

```bash
chmod 600 /root/.ssh/config
ssh -o StrictHostKeyChecking=accept-new -T git@github.com
```

预期：输出 `Hi <用户名>! You've successfully authenticated, but GitHub does not provide shell access.`（退出码为 1 属正常）。

- [ ] **Step 4: 添加远端并推送**

```bash
git remote add origin git@github.com:${GITHUB_USER}/personal-stack.git
git branch -M main
git push -u origin main
```

（把 `${GITHUB_USER}` 换成 Step 2 中告诉我的用户名。）

预期：`main` 推送成功，远端出现全部提交。

- [ ] **Step 5: 验证远端可用**

```bash
git fetch origin
git status -sb
```

预期：`## main...origin/main`，无待推送提交。

---

### Task 8: GitHub Actions CI 首次绿灯

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 7 的 GitHub 远端；Task 3 的后端工程与 `requirements-dev.txt`；Task 5 的前端工程与 `package-lock.json`。
- Produces: CI 工作流 `CI`，在 push/PR 时运行 `backend`（ruff + pytest，带 MySQL service）与 `frontend`（tsc + eslint + vitest + build）两个 job；后续里程碑在此工作流上扩展。

- [ ] **Step 1: 写 CI 工作流**

`.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: personal_stack_test
          MYSQL_USER: app
          MYSQL_PASSWORD: app
        ports:
          - 3306:3306
        options: >-
          --health-cmd "mysqladmin ping -h 127.0.0.1 -uroot -proot"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements-dev.txt
      - run: pip install -r requirements-dev.txt
      - run: ruff check .
      - run: python -m pytest -v
        env:
          DATABASE_URL: mysql+asyncmy://app:app@127.0.0.1:3306/personal_stack_test

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm test -- --run
      - run: npm run build
```

- [ ] **Step 2: 本地预检（在推送前先复现 CI 会跑的命令）**

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/python -m pytest -v && cd ..
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npm run lint && npx tsc --noEmit && npm test -- --run && npm run build"
```

预期：全部通过。若失败，先修本地，再继续。

- [ ] **Step 3: 提交并推送**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 首次接入 GitHub Actions（后端 lint/测试 + 前端检查/构建）"
git push
```

- [ ] **Step 4: 用户操作——检查 Actions 结果（需要你动手）**

在浏览器打开你的仓库 → Actions 标签页，查看 `CI` 工作流最新一次运行。

预期：`backend` 与 `frontend` 两个 job 均为绿色 ✅。
若为红色，把失败的 job 名称和报错日志贴给我，我来修复后重新提交。

- [ ] **Step 5: 验证推送与 CI 的完整闭环记录**

```bash
git log --oneline -5
git status -sb
```

预期：能看到 M0 的全部提交；工作区干净、与远端同步。

---

## M0 完成定义（DoD）

1. `docker compose -f deploy/compose.dev.yaml up -d --build` 后：`http://localhost:5173` 页面显示 `后端状态：API 正常`。
2. `make check-backend` 与 `make check-frontend` 全绿。
3. GitHub 仓库 `main` 分支上 CI 两个 job 绿灯。
4. `deploy/ops/host/install-docker.sh` + `daemon.json` 已入库，换机可复现环境。

完成后进入 M1（认证）计划：用户表与迁移、Argon2 登录、Cookie JWT、登录限流、前端登录页。
