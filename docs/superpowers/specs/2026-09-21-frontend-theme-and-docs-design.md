# 前端主题化改版与交付文档 设计规格

- 日期：2026-09-21
- 状态：已与项目所有者逐节确认
- 范围：三项交付物 —— ① 部署教学文档 ② 后端 API 接口手册 ③ 前端视觉改版（博客主页 + 网盘入口，主题切换与自定义美化）

## 1. 背景与目标

M0–M6 已完成功能、CI/CD 与运维。本轮解决三件事：

1. **部署教学文档**：把从空机到上线的完整流程写成可照做的教程（含本项目真实踩过的坑）。
2. **API 接口手册**：整理后端全部接口，按模块分组，可查阅、可复制 curl。
3. **前端视觉改版**：以 Vercel / Linear 的极简风格重做界面，引入主题系统：访客可自选并持久化，后台可设置全站默认；支持背景、主色、圆角、毛玻璃强度自定义。

成功标准：

- 文档能让一个没参与过本项目的人按步骤完成部署，每步有验证方式。
- API 手册覆盖所有现存端点，字段与代码一致。
- 访客切换主题即时生效且刷新保留；后台改默认后，未自定义的访客下次访问生效。
- 界面为圆角卡片 + 毛玻璃质感，明暗两态均可用；移动端可用。
- 不破坏现有功能与自动部署链路；测试全绿；生产浏览器验证通过。

## 2. 需求澄清结论

| 问题 | 结论 |
|---|---|
| 定制范围与存储 | 访客自选（localStorage）+ 后台可设全站默认（数据库） |
| 可自定义维度 | 明暗模式、主色、背景（纯色/渐变/预设）、圆角与毛玻璃强度滑杆；**不做**背景图上传与字体选择 |
| 样式技术栈 | Tailwind CSS v4 + CSS 变量（design token 驱动） |
| 页面结构 | 访客/登录双形态：未登录看博客列表，已登录首页为控制台（含博客、网盘两个入口） |
| 预设资源 | 背景用 CSS 渐变实现，不引入图片二进制、不做上传 |

## 3. 非目标

- 背景图片上传、自定义字体、动效开关（用户明确排除）
- 组件库（Ant Design / shadcn）、服务端渲染、多语言、评论、搜索（沿用一期非目标）
- 后端接口语义变更（仅新增 settings 模块）；基础设施与 CI/CD 流程改动
- 更换 Markdown 编辑器或富文本

## 4. 主题模型

### 4.1 配置结构（前后端共用 schema）

```jsonc
{
  "mode": "system",            // light | dark | system
  "accent": "violet",          // violet | blue | emerald | rose | amber | slate
  "radius": 16,                // 0–28 px
  "blur": 12,                  // 0–24 px
  "background": {
    "type": "gradient",        // solid | gradient | mesh
    "value": "aurora"          // solid: #rgb/#rrggbb；gradient/mesh: 预设名
  }
}
```

- `background.value` 合法值：solid 时为十六进制色值；gradient 时 `aurora|daylight|dusk`；mesh 时 `mesh-violet|mesh-emerald`
- 未知字段一律拒绝（后端 `extra="forbid"`，前端解析时忽略并回退）

### 4.2 合并优先级（低 → 高）

1. 内置预设（前端常量，5 套：`vercel-light`、`vercel-dark`、`linear-dark`、`forest`、`sunset`）
2. 站默认（后端 `site_settings.theme`，允许部分字段）
3. 访客覆盖（localStorage `personal-stack.theme.v1`，允许部分字段）

`resolveTheme(preset, siteDefault, visitorOverride) -> ResolvedTheme` 为纯函数；任一层字段非法或越界时回退到低优先级的有效值。访客「恢复默认」清空第 3 层；后台「重置为预设」把第 2 层写回内置默认。**内置默认预设为 `vercel-dark`**（后端迁移写入的默认值也是它的完整配置）。

### 4.3 CSS 变量契约

| 变量 | 用途 |
|---|---|
| `--accent` / `--accent-fg` | 主色与其上的文字色 |
| `--bg` / `--bg-elevated` / `--fg` / `--fg-muted` / `--border` | 基础色板 |
| `--radius` / `--blur` / `--shadow` | 圆角、毛玻璃强度、阴影 |
| `--bg-image` / `--bg-overlay` | 背景图层与叠加层 |

- 变量写在 `:root`；`mode` 同步写到 `<html data-mode="light|dark">`，`system` 时依据 `prefers-color-scheme` 解析为实际值并监听变化
- Tailwind v4 通过 `@theme inline` 把变量映射为工具类（`bg-surface`、`text-muted`、`rounded-card`、`backdrop-blur-card` 等）；**组件不得直接写死颜色**
- 尊重 `prefers-reduced-motion`（减少过渡动效）

## 5. 后端设计

### 5.1 数据表（迁移 `0004_create_site_settings`）

```
site_settings
  key         VARCHAR(64)  PRIMARY KEY   -- v1 仅 'theme'
  value       JSON         NOT NULL
  updated_at  DATETIME     NOT NULL
```

迁移内插入 `theme` 默认值（内置 `vercel-dark` 的完整配置），保证公开接口恒有数据。

### 5.2 模块与文件

新模块 `backend/app/modules/settings/`：`models.py`（`SiteSetting`）、`schemas.py`（`ThemeConfig` 及子模型）、`service.py`（读取/局部合并/校验）、`router.py`（公开与管理两个路由）。`main.py` 装配；`alembic/env.py` 注册模型。

### 5.3 接口

```
GET  /api/settings/theme        公开；返回 {"theme": ThemeConfig}（完整站默认）
PUT  /api/admin/settings/theme  需登录；body 为部分字段；与现值合并后保存；返回完整 ThemeConfig
```

- 局部合并语义与访客覆盖一致：只提交要改的字段
- 校验错误返回 422 `validation_error`；`GET` 无需鉴权且不含敏感信息
- 不做缓存

## 6. 前端设计

### 6.1 路由

```
/             HomeGate：未登录 → 博客列表；已登录 → 控制台
/blog         博客列表（固定地址）
/posts/:slug  文章详情
/drive        网盘
/login        登录
/admin/*      后台（仅视觉迁移）
```

### 6.2 主题子系统（`frontend/src/theme/`）

| 文件 | 职责 |
|---|---|
| `types.ts` | `ThemeConfig`、`ResolvedTheme`、`BackgroundConfig` |
| `presets.ts` | 5 套主题预设、5 个背景预设（CSS 渐变）、默认配置 |
| `resolve.ts` | 纯函数三层合并与非法值回退 |
| `apply.ts` | 写 CSS 变量与 `data-mode`；系统模式监听 |
| `ThemeProvider.tsx` | 拉取站默认（失败回退预设）、读写 localStorage、暴露 `overrides`/`setOverride`/`resetOverride` |
| `ThemePanel.tsx` | 悬浮按钮打开毛玻璃面板：主题预设、明暗、主色、圆角/模糊滑杆、背景、恢复默认；实时预览 |

### 6.3 视觉组件（`frontend/src/components/ui/`）

- `BackgroundLayer`：固定全屏背景层（solid/gradient/mesh + 叠加层）
- `Surface`：统一毛玻璃卡片（半透明 + `backdrop-blur` + 边框 + 圆角变量 + 阴影）
- `AppShell`：顶栏（站名、博客/网盘/控制台/管理导航、登录态菜单、主题按钮）+ 内容容器；移动端折叠菜单
- `Button` / `IconButton` / `Field`：基础控件（统一圆角与配色变量）

### 6.4 页面迁移

- `BlogListPage`、`PostDetailPage`、`LoginPage`、`AdminPostsPage`、`PostFormPage`、`DrivePage` 全部迁移到 `AppShell` + `Surface` + 工具类；功能与文案不变
- 新增 `ConsolePage`：问候 + 统计卡（文章数 `GET /api/admin/posts` 的 `total`、文件数与已用空间 `GET /api/storage/usage`）+ 两张入口卡（博客管理、我的网盘）
- 新增 `HomeGate`：根据 `useAuth()` 分流
- `MarkdownView` 增加基于 token 的排版（`@tailwindcss/typography` + 暗色适配）
- 旧 `AdminHeader` 并入 `AppShell` 用户菜单后删除

### 6.5 依赖

新增 `tailwindcss@^4`、`@tailwindcss/vite@^4`、`@tailwindcss/typography@^0.5`；无其他运行时依赖。

## 7. 文档交付

### 7.1 `docs/deployment-tutorial.md`

从零到上线的教学文档，章节：拓扑与前置 → 系统与 Docker（含镜像加速、防火墙）→ 代码与密钥（SSH、`.env` 生成）→ 首次部署（生产 compose、迁移、种子）→ Cloudflare Tunnel 全步骤（含 Public Hostname 与真实 IP 链路）→ CI/CD（GHCR、自托管 Runner、部署与回滚）→ 监控（Prometheus/Grafana）→ 备份与恢复演练 → 安全加固清单 → 故障排查 → 命令速查。每步给验证命令与预期输出；把真实坑写进对应章节（GitHub HTTPS 不可达、GHCR 慢、SELinux/rsync、`$$` 转义、CSP 与 Cloudflare 信标、compose 项目名事故）。

### 7.2 `docs/api-reference.md`

按模块分组（auth / blog / storage / settings）：方法、路径、鉴权、请求字段、响应示例、错误码，附 curl 示例；说明开发环境 `/docs` 与 `/openapi.json` 用法、生产未暴露；标注 Cookie 鉴权与错误响应统一格式。

## 8. 测试策略

- 后端（TDD）：settings 公开读取、PUT 鉴权与局部合并、非法值 422、迁移建表与默认值；全套回归
- 前端（Vitest）：`resolve` 优先级与回退、`apply` 变量落地、Provider 持久化与恢复默认、`ThemePanel` 交互、`HomeGate` 双形态、控制台统计；现有页面测试按新标记调整
- E2E：生产浏览器验证（主题切换与保留、后台默认生效、博客与网盘回归、移动端）

## 9. 交付与风险

- 迁移 `0004` 与前端代码经现有自动部署链路发布（不改 CI/CD）
- 风险与对策：
  - Tailwind v4 与 Vite 5 兼容性 → 先本地构建验证，失败则回退 Tailwind v3.4（仅配置方式不同）
  - 现有页面测试因标记变化而失败 → 视为预期内，随迁移同步更新
  - 主题变量遗漏导致暗色下对比度不足 → 组件只用 token 工具类，评审阶段核对明暗两态
  - 前端上线异常 → 走既有 `deploy-release.sh` 回滚（镜像按 sha 可追溯）
