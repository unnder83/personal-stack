# M7 前端主题化改版与交付文档 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 Tailwind v4 + CSS 变量实现可切换、可自定义、可持久化的主题系统，重构前端为 Vercel/Linear 风格的圆角毛玻璃界面（访客看博客、登录看控制台双形态），并交付部署教学文档与 API 接口手册。

**Architecture:** 主题 = 三层合并（内置预设 → 后端站默认 → 访客 localStorage 覆盖）后写入 `:root` CSS 变量；组件只用 Tailwind 工具类，不写死颜色。后端新增 `settings` 模块（KV 表 + 公开读/管理写两个接口），迁移 `0004` 随现有自动部署链路发布。

**Tech Stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS v4（`@tailwindcss/vite`、`@tailwindcss/typography`）+ Vitest；FastAPI + SQLAlchemy 2.0 + Alembic（后端仅加 settings 模块）。

**Spec:** `docs/superpowers/specs/2026-09-21-frontend-theme-and-docs-design.md`

## Global Constraints

- 前端 Node 命令一律通过容器执行：`docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine <cmd>`；后端测试 `make check-backend`（会自动起 dev MySQL）。
- 组件**不得写死颜色**：只能用 token 工具类（`bg-bg`/`bg-surface`/`text-fg`/`text-muted`/`border-border`/`bg-accent`/`text-accent-fg`/`rounded-card`/`shadow-card`/`backdrop-blur-card`）；内联样式只允许来自 CSS 变量（`style={{ ... }}` 禁止写常量色值）。
- 主题配置 schema 字段固定：`mode(light|dark|system)`、`accent(violet|blue|emerald|rose|amber|slate)`、`radius(0–28)`、`blur(0–24)`、`background.type(solid|gradient|mesh)`、`background.value`（solid 为 `#rgb/#rrggbb`；gradient 为 `aurora|daylight|dusk`；mesh 为 `mesh-violet|mesh-emerald`）；未知字段拒绝。
- 内置默认预设 `vercel-dark`；localStorage 键 `personal-stack.theme.v1`。
- 后端 settings 模块边界：KV 表归 settings 模块所有；管理端点用 `app.modules.auth.deps.get_current_user`。
- 现有功能与文案不变；现有页面测试允许因标记结构小幅调整；自动部署链路必须保持可用（push 后 Deploy 成功）。
- 提交信息使用中文 conventional commits。

## Review Focus

1. **主题三层优先级与回退**：预设 < 站默认 < 访客覆盖；任一层字段非法/越界时回退而非崩溃；后端不可达时用默认预设启动。钉在 Task 2（`resolve.test.ts`、`sanitize` 用例）与 Task 3（Provider 后端失败回退用例）。
2. **持久化与「恢复默认」**：切主题刷新保留；恢复默认清空覆盖并回到站默认/预设；不写入非法 localStorage 值。钉在 Task 3（Provider 持久化与 reset 用例）。
3. **防闪烁与暗色对比度**：首屏在 JS 挂载前依据 localStorage/系统设置 `data-mode`；明暗两态均使用 token，无写死色值（`grep` 断言组件目录无 hex 色值）。钉在 Task 1（index.html 内联脚本）与 Task 6（`test_no_hardcoded_colors.sh`）。
4. **访客/登录双形态**：未登录 `/` 显示博客列表；已登录显示控制台（统计卡与两个入口）；`/blog` 始终为博客列表。钉在 Task 5（`HomeGate.test.tsx`、`ConsolePage.test.tsx`）。
5. **后端设置接口的鉴权与校验**：公开 GET 无需登录且返回完整默认；PUT 未登录 401；非法值/未知字段 422；局部更新合并语义正确。钉在 Task 4（`test_settings_api.py`）。

---

### Task 1: Tailwind v4 接入与设计令牌基础

**Files:**
- Modify: `frontend/package.json`（新增 3 个 devDependencies）
- Modify: `frontend/vite.config.ts`（挂 Tailwind 插件）
- Create: `frontend/src/styles/index.css`（令牌与基础样式）
- Modify: `frontend/src/main.tsx`（引入样式）
- Modify: `frontend/index.html`（防闪烁内联脚本）
- Delete: `frontend/src/index.css`（若存在；M0–M6 未创建则忽略）

**Interfaces:**
- Consumes: 现有 Vite/React 工程。
- Produces: Tailwind 工具类可用；CSS 变量默认值与工具类映射（`bg-bg`、`bg-surface`、`text-fg`、`text-muted`、`border-border`、`bg-accent`、`text-accent-fg`、`rounded-card`、`shadow-card`、`backdrop-blur-card`、`dark:` 变体基于 `data-mode`）。

- [ ] **Step 1: 安装依赖**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npm install -D tailwindcss@^4 @tailwindcss/vite@^4 @tailwindcss/typography@^0.5"
```

预期：安装成功，`package.json`/lockfile 更新。

- [ ] **Step 2: 写令牌样式**

`frontend/src/styles/index.css`：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));

:root {
  --bg: #0a0a0a;
  --surface: rgba(255, 255, 255, 0.06);
  --fg: #ededed;
  --fg-muted: #a1a1a1;
  --border: rgba(255, 255, 255, 0.12);
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  --accent: #8b5cf6;
  --accent-fg: #ffffff;
  --radius: 16px;
  --blur: 12px;
  --bg-image: none;
  --bg-overlay: rgba(0, 0, 0, 0.25);
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-muted: var(--fg-muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --radius-card: var(--radius);
  --shadow-card: var(--shadow);
  --blur-card: var(--blur);
}

html,
body,
#root {
  min-height: 100%;
}

body {
  background-color: var(--bg);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: 挂插件与引入样式**

`frontend/vite.config.ts` 改为：

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

`frontend/src/main.tsx` 顶部在 highlight.js 样式之后增加：

```tsx
import './styles/index.css'
```

- [ ] **Step 4: index.html 防闪烁脚本**

`frontend/index.html` 的 `<head>` 末尾（`<title>` 之后）插入：

```html
    <script>
      ;(function () {
        try {
          var raw = localStorage.getItem('personal-stack.theme.v1')
          var mode = raw ? JSON.parse(raw).mode || 'system' : 'system'
          var dark =
            mode === 'dark' ||
            (mode === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches)
          document.documentElement.dataset.mode = dark ? 'dark' : 'light'
        } catch (error) {
          document.documentElement.dataset.mode = 'dark'
        }
      })()
    </script>
```

- [ ] **Step 5: 验证构建与既有测试**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run && npm run build"
```

预期：全部通过；构建产物中 CSS 明显变大（Tailwind 生效）。

- [ ] **Step 6: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/styles/index.css frontend/src/main.tsx frontend/index.html
git commit -m "feat: 接入 Tailwind v4 与设计令牌"
```

---

### Task 2: 主题纯函数层（类型、预设、合并、变量）

**Files:**
- Create: `frontend/src/theme/types.ts`
- Create: `frontend/src/theme/presets.ts`
- Create: `frontend/src/theme/resolve.ts`
- Create: `frontend/src/theme/resolve.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces（后续任务依赖的精确签名）：
  - `types.ts`：`ThemeMode`、`Accent`、`BackgroundType`、`BackgroundConfig`、`ThemeConfig`、`ThemePatch`、`EffectiveMode`、`Palette`、`ResolvedTheme` 与常量数组 `MODES`/`ACCENTS`/`BACKGROUND_TYPES`/`GRADIENT_PRESETS`/`MESH_PRESETS`
  - `presets.ts`：`Preset` 类型、`PRESETS: Preset[]`、`DEFAULT_PRESET_ID = 'vercel-dark'`、`getPreset(id): Preset`、`ACCENT_COLORS: Record<Accent, {accent, fg}>`、`BACKGROUND_CSS: Record<string, string>`、`BACKGROUND_OVERLAY: Record<EffectiveMode, string>`
  - `resolve.ts`：`sanitizePatch(input: unknown): ThemePatch`、`mergeTheme(base: ThemeConfig, patch: ThemePatch): ThemeConfig`、`effectiveMode(mode: ThemeMode, prefersDark: boolean): EffectiveMode`、`resolveTheme(preset: Preset, siteDefault: ThemePatch | null, visitor: ThemePatch | null, prefersDark: boolean): ResolvedTheme`、`toCssVars(theme: ResolvedTheme): Record<string, string>`

- [ ] **Step 1: 写失败测试**

`frontend/src/theme/resolve.test.ts`：

```ts
import { describe, expect, it } from 'vitest'

import { getPreset } from './presets'
import { effectiveMode, mergeTheme, resolveTheme, sanitizePatch, toCssVars } from './resolve'
import type { ThemeConfig } from './types'

const preset = getPreset('vercel-dark')

describe('sanitizePatch', () => {
  it('丢弃未知字段与非法类型', () => {
    const patch = sanitizePatch({
      mode: 'neon',
      accent: 'blue',
      radius: 'big',
      blur: 999,
      background: { type: 'video', value: 'x' },
      extra: 1,
    })

    expect(patch).toEqual({ accent: 'blue' })
  })

  it('clamp 数值范围', () => {
    expect(sanitizePatch({ radius: -5, blur: 100 })).toEqual({ radius: 0, blur: 24 })
  })
  it('solid 背景要求十六进制色值', () => {
    expect(sanitizePatch({ background: { type: 'solid', value: 'red' } })).toEqual({})
    expect(sanitizePatch({ background: { type: 'solid', value: '#112233' } })).toEqual({
      background: { type: 'solid', value: '#112233' },
    })
  })

  it('gradient/mesh 背景要求预设名', () => {
    expect(sanitizePatch({ background: { type: 'gradient', value: 'aurora' } })).toEqual({
      background: { type: 'gradient', value: 'aurora' },
    })
    expect(sanitizePatch({ background: { type: 'mesh', value: 'aurora' } })).toEqual({})
  })
})

describe('mergeTheme', () => {
  it('按字段覆盖并保留其余值', () => {
    const base = presetToConfig()
    const merged = mergeTheme(base, { accent: 'rose' })

    expect(merged.accent).toBe('rose')
    expect(merged.radius).toBe(base.radius)
  })
})

describe('effectiveMode', () => {
  it('system 跟随系统偏好', () => {
    expect(effectiveMode('system', true)).toBe('dark')
    expect(effectiveMode('system', false)).toBe('light')
    expect(effectiveMode('light', true)).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('访客覆盖优先于站默认与预设', () => {
    const resolved = resolveTheme(preset, { accent: 'emerald' }, { accent: 'rose' }, true)

    expect(resolved.config.accent).toBe('rose')
    expect(resolved.effectiveMode).toBe('dark')
    expect(resolved.palette.bg).toBe(preset.dark.bg)
  })

  it('站默认生效当访客无覆盖', () => {
    const resolved = resolveTheme(preset, { radius: 4 }, null, false)

    expect(resolved.config.radius).toBe(4)
  })

  it('非法访客值被忽略并回退', () => {
    const resolved = resolveTheme(preset, null, sanitizePatch({ accent: 'nope' }), false)

    expect(resolved.config.accent).toBe(preset.accent)
  })
})

describe('toCssVars', () => {
  it('输出变量包含调色板、主色、圆角与背景', () => {
    const vars = toCssVars(resolveTheme(preset, null, null, true))

    expect(vars['--bg']).toBe(preset.dark.bg)
    expect(vars['--radius']).toBe(`${preset.radius}px`)
    expect(vars['--accent']).toBeTruthy()
    expect(vars['--bg-image']).toBeTruthy()
  })
})

function presetToConfig(): ThemeConfig {
  const resolved = resolveTheme(preset, null, null, true)
  return resolved.config
}
```

- [ ] **Step 2: 运行确认失败**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run src/theme/resolve.test.ts 2>&1 | grep -E "Failed to resolve|failed" | head -3
```

预期：FAIL，无法解析 `./presets`。

- [ ] **Step 3: 实现类型**

`frontend/src/theme/types.ts`：

```ts
export const MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof MODES)[number]

export const ACCENTS = ['violet', 'blue', 'emerald', 'rose', 'amber', 'slate'] as const
export type Accent = (typeof ACCENTS)[number]

export const BACKGROUND_TYPES = ['solid', 'gradient', 'mesh'] as const
export type BackgroundType = (typeof BACKGROUND_TYPES)[number]

export const GRADIENT_PRESETS = ['aurora', 'daylight', 'dusk'] as const
export const MESH_PRESETS = ['mesh-violet', 'mesh-emerald'] as const

export type BackgroundConfig = {
  type: BackgroundType
  value: string
}

export type ThemeConfig = {
  mode: ThemeMode
  accent: Accent
  radius: number
  blur: number
  background: BackgroundConfig
}

export type ThemePatch = {
  mode?: ThemeMode
  accent?: Accent
  radius?: number
  blur?: number
  background?: BackgroundConfig
}

export type EffectiveMode = 'light' | 'dark'

export type Palette = {
  bg: string
  surface: string
  fg: string
  fgMuted: string
  border: string
  shadow: string
}

export type ResolvedTheme = {
  config: ThemeConfig
  effectiveMode: EffectiveMode
  palette: Palette
}
```

- [ ] **Step 4: 实现预设**

`frontend/src/theme/presets.ts`：

```ts
import type { Accent, BackgroundConfig, EffectiveMode, Palette } from './types'

export type Preset = {
  id: string
  label: string
  accent: Accent
  radius: number
  blur: number
  background: BackgroundConfig
  light: Palette
  dark: Palette
}

export const DEFAULT_PRESET_ID = 'vercel-dark'

export const PRESETS: Preset[] = [
  {
    id: 'vercel-dark',
    label: 'Vercel Dark',
    accent: 'violet',
    radius: 16,
    blur: 12,
    background: { type: 'gradient', value: 'aurora' },
    light: {
      bg: '#fafafa',
      surface: 'rgba(255, 255, 255, 0.72)',
      fg: '#111111',
      fgMuted: '#666666',
      border: 'rgba(0, 0, 0, 0.08)',
      shadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
    },
    dark: {
      bg: '#0a0a0a',
      surface: 'rgba(255, 255, 255, 0.06)',
      fg: '#ededed',
      fgMuted: '#a1a1a1',
      border: 'rgba(255, 255, 255, 0.12)',
      shadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
    },
  },
  {
    id: 'vercel-light',
    label: 'Vercel Light',
    accent: 'blue',
    radius: 14,
    blur: 10,
    background: { type: 'solid', value: '#f5f5f5' },
    light: {
      bg: '#ffffff',
      surface: 'rgba(255, 255, 255, 0.8)',
      fg: '#0a0a0a',
      fgMuted: '#5f5f5f',
      border: 'rgba(0, 0, 0, 0.1)',
      shadow: '0 6px 24px rgba(0, 0, 0, 0.07)',
    },
    dark: {
      bg: '#111111',
      surface: 'rgba(255, 255, 255, 0.07)',
      fg: '#f2f2f2',
      fgMuted: '#a8a8a8',
      border: 'rgba(255, 255, 255, 0.14)',
      shadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
    },
  },
  {
    id: 'linear-dark',
    label: 'Linear Dark',
    accent: 'violet',
    radius: 12,
    blur: 16,
    background: { type: 'mesh', value: 'mesh-violet' },
    light: {
      bg: '#f7f7f9',
      surface: 'rgba(255, 255, 255, 0.7)',
      fg: '#16161d',
      fgMuted: '#6b6b76',
      border: 'rgba(20, 20, 40, 0.1)',
      shadow: '0 10px 30px rgba(30, 30, 60, 0.1)',
    },
    dark: {
      bg: '#08090a',
      surface: 'rgba(255, 255, 255, 0.05)',
      fg: '#f7f8f8',
      fgMuted: '#8a8f98',
      border: 'rgba(255, 255, 255, 0.1)',
      shadow: '0 10px 34px rgba(0, 0, 0, 0.55)',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    accent: 'emerald',
    radius: 20,
    blur: 14,
    background: { type: 'gradient', value: 'daylight' },
    light: {
      bg: '#f4f7f4',
      surface: 'rgba(255, 255, 255, 0.75)',
      fg: '#152019',
      fgMuted: '#5c6b60',
      border: 'rgba(20, 50, 30, 0.1)',
      shadow: '0 8px 26px rgba(20, 60, 35, 0.12)',
    },
    dark: {
      bg: '#0b120e',
      surface: 'rgba(255, 255, 255, 0.06)',
      fg: '#e8f0ea',
      fgMuted: '#93a79a',
      border: 'rgba(255, 255, 255, 0.12)',
      shadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    accent: 'amber',
    radius: 18,
    blur: 10,
    background: { type: 'gradient', value: 'dusk' },
    light: {
      bg: '#fdf6f0',
      surface: 'rgba(255, 255, 255, 0.78)',
      fg: '#241812',
      fgMuted: '#7a6357',
      border: 'rgba(80, 40, 20, 0.1)',
      shadow: '0 8px 26px rgba(120, 60, 20, 0.12)',
    },
    dark: {
      bg: '#150f0c',
      surface: 'rgba(255, 255, 255, 0.06)',
      fg: '#f6ece5',
      fgMuted: '#b39c8f',
      border: 'rgba(255, 255, 255, 0.12)',
      shadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    },
  },
]

export function getPreset(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]
}

export const ACCENT_COLORS: Record<Accent, { accent: string; fg: string }> = {
  violet: { accent: '#8b5cf6', fg: '#ffffff' },
  blue: { accent: '#3b82f6', fg: '#ffffff' },
  emerald: { accent: '#10b981', fg: '#06281d' },
  rose: { accent: '#f43f5e', fg: '#ffffff' },
  amber: { accent: '#f59e0b', fg: '#2a1a02' },
  slate: { accent: '#64748b', fg: '#ffffff' },
}

export const BACKGROUND_CSS: Record<string, string> = {
  aurora:
    'radial-gradient(1200px 600px at 15% -10%, rgba(139, 92, 246, 0.35), transparent 60%), radial-gradient(900px 500px at 85% 0%, rgba(59, 130, 246, 0.28), transparent 55%), radial-gradient(700px 500px at 50% 110%, rgba(16, 185, 129, 0.22), transparent 60%)',
  daylight:
    'radial-gradient(1000px 500px at 20% -10%, rgba(16, 185, 129, 0.25), transparent 60%), radial-gradient(800px 500px at 90% 10%, rgba(59, 130, 246, 0.2), transparent 60%)',
  dusk: 'radial-gradient(1000px 600px at 10% -10%, rgba(244, 63, 94, 0.28), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(245, 158, 11, 0.26), transparent 60%)',
  'mesh-violet':
    'radial-gradient(600px 600px at 10% 20%, rgba(139, 92, 246, 0.3), transparent 60%), radial-gradient(600px 600px at 80% 10%, rgba(236, 72, 153, 0.22), transparent 60%), radial-gradient(700px 700px at 50% 90%, rgba(59, 130, 246, 0.24), transparent 60%)',
  'mesh-emerald':
    'radial-gradient(600px 600px at 15% 20%, rgba(16, 185, 129, 0.3), transparent 60%), radial-gradient(600px 600px at 85% 15%, rgba(59, 130, 246, 0.22), transparent 60%), radial-gradient(700px 700px at 50% 95%, rgba(139, 92, 246, 0.2), transparent 60%)',
}

export const BACKGROUND_OVERLAY: Record<EffectiveMode, string> = {
  light: 'rgba(255, 255, 255, 0.45)',
  dark: 'rgba(0, 0, 0, 0.35)',
}
```

- [ ] **Step 5: 实现合并与变量**

`frontend/src/theme/resolve.ts`：

```ts
import {
  ACCENTS,
  BACKGROUND_TYPES,
  GRADIENT_PRESETS,
  MESH_PRESETS,
  MODES,
} from './types'
import type {
  Accent,
  BackgroundConfig,
  EffectiveMode,
  ResolvedTheme,
  ThemeConfig,
  ThemeMode,
  ThemePatch,
} from './types'
import {
  ACCENT_COLORS,
  BACKGROUND_CSS,
  BACKGROUND_OVERLAY,
  type Preset,
} from './presets'

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return Math.min(max, Math.max(min, Math.round(value)))
}

function sanitizeBackground(input: unknown): BackgroundConfig | undefined {
  if (!isRecord(input)) return undefined
  const type = input.type
  const value = input.value
  if (typeof type !== 'string' || typeof value !== 'string') return undefined
  if (!(BACKGROUND_TYPES as readonly string[]).includes(type)) return undefined
  if (type === 'solid') {
    return HEX_RE.test(value) ? { type: 'solid', value } : undefined
  }
  const allowed: readonly string[] = type === 'gradient' ? GRADIENT_PRESETS : MESH_PRESETS
  return allowed.includes(value) ? { type: type as BackgroundConfig['type'], value } : undefined
}

export function sanitizePatch(input: unknown): ThemePatch {
  if (!isRecord(input)) return {}
  const patch: ThemePatch = {}
  if (typeof input.mode === 'string' && (MODES as readonly string[]).includes(input.mode)) {
    patch.mode = input.mode as ThemeMode
  }
  if (typeof input.accent === 'string' && (ACCENTS as readonly string[]).includes(input.accent)) {
    patch.accent = input.accent as Accent
  }
  const radius = clamp(input.radius, 0, 28)
  if (radius !== undefined) patch.radius = radius
  const blur = clamp(input.blur, 0, 24)
  if (blur !== undefined) patch.blur = blur
  const background = sanitizeBackground(input.background)
  if (background) patch.background = background
  return patch
}

export function mergeTheme(base: ThemeConfig, patch: ThemePatch): ThemeConfig {
  return {
    mode: patch.mode ?? base.mode,
    accent: patch.accent ?? base.accent,
    radius: patch.radius ?? base.radius,
    blur: patch.blur ?? base.blur,
    background: patch.background ?? base.background,
  }
}

export function effectiveMode(mode: ThemeMode, prefersDark: boolean): EffectiveMode {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function resolveTheme(
  preset: Preset,
  siteDefault: ThemePatch | null,
  visitor: ThemePatch | null,
  prefersDark: boolean,
): ResolvedTheme {
  const presetConfig: ThemeConfig = {
    mode: 'system',
    accent: preset.accent,
    radius: preset.radius,
    blur: preset.blur,
    background: preset.background,
  }
  const withSite = siteDefault ? mergeTheme(presetConfig, siteDefault) : presetConfig
  const config = visitor ? mergeTheme(withSite, visitor) : withSite
  const mode = effectiveMode(config.mode, prefersDark)
  return {
    config,
    effectiveMode: mode,
    palette: mode === 'dark' ? preset.dark : preset.light,
  }
}

export function toCssVars(theme: ResolvedTheme): Record<string, string> {
  const { config, effectiveMode: mode, palette } = theme
  const backgroundCss =
    config.background.type === 'solid'
      ? 'none'
      : BACKGROUND_CSS[config.background.value] ?? 'none'
  return {
    '--bg': config.background.type === 'solid' ? config.background.value : palette.bg,
    '--surface': palette.surface,
    '--fg': palette.fg,
    '--fg-muted': palette.fgMuted,
    '--border': palette.border,
    '--shadow': palette.shadow,
    '--accent': ACCENT_COLORS[config.accent].accent,
    '--accent-fg': ACCENT_COLORS[config.accent].fg,
    '--radius': `${config.radius}px`,
    '--blur': `${config.blur}px`,
    '--bg-image': backgroundCss,
    '--bg-overlay': BACKGROUND_OVERLAY[mode],
  }
}
```

- [ ] **Step 6: 运行确认通过**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run src/theme/resolve.test.ts 2>&1 | grep -E "Test Files|Tests " | head -3
```

预期：全部通过。

- [ ] **Step 7: 类型检查与提交**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint"
git add frontend/src/theme
git commit -m "feat: 主题纯函数层（类型、预设、三层合并与 CSS 变量）"
```

---

### Task 3: 主题运行时（Provider、应用器、面板与背景层）

**Files:**
- Create: `frontend/src/theme/apply.ts`
- Create: `frontend/src/theme/ThemeProvider.tsx`
- Create: `frontend/src/theme/ThemePanel.tsx`
- Create: `frontend/src/theme/ThemeProvider.test.tsx`
- Create: `frontend/src/components/ui/BackgroundLayer.tsx`
- Create: `frontend/src/components/ui/Surface.tsx`
- Modify: `frontend/src/App.tsx`（包裹 `ThemeProvider`，暂时保留现有路由结构）

**Interfaces:**
- Consumes: Task 2 的 `resolve.ts`/`presets.ts`/`types.ts`。
- Produces:
  - `applyTheme(theme: ResolvedTheme, root?: HTMLElement): void`（写变量 + `data-mode`）
  - `ThemeProvider`：context 值 `{ config: ThemeConfig; resolved: ResolvedTheme; setOverride(patch: ThemePatch): void; resetOverride(): void; siteDefault: ThemePatch | null }`
  - `useTheme(): ThemeProvider 的 context 值`
  - `ThemePanel`：悬浮按钮 + 面板（预设、模式、主色、圆角/模糊滑杆、背景、恢复默认）
  - `BackgroundLayer`、`Surface`

- [ ] **Step 1: 写失败测试**

`frontend/src/theme/ThemeProvider.test.tsx`：

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemePanel } from './ThemePanel'
import { ThemeProvider, useTheme } from './ThemeProvider'

const STORAGE_KEY = 'personal-stack.theme.v1'

function Probe() {
  const { config } = useTheme()
  return <span data-testid="accent">{config.accent}</span>
}

function stubFetch(siteTheme: unknown | 'fail') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/settings/theme')) {
        if (siteTheme === 'fail') return Promise.reject(new Error('offline'))
        return Promise.resolve(
          Response.json({ theme: siteTheme }),
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute('data-mode')
})

describe('ThemeProvider', () => {
  it('应用站默认并在面板修改后持久化到 localStorage', async () => {
    stubFetch({ mode: 'dark', accent: 'emerald', radius: 8, blur: 6 })

    render(
      <ThemeProvider>
        <Probe />
        <ThemePanel />
      </ThemeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('accent').textContent).toBe('emerald')
    })
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('8px')

    fireEvent.click(screen.getByRole('button', { name: '主题' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rose' }))

    await waitFor(() => {
      expect(screen.getByTestId('accent').textContent).toBe('rose')
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').accent).toBe('rose')
  })

  it('后端不可用时使用内置预设', async () => {
    stubFetch('fail')

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('accent').textContent).toBe('violet')
  })

  it('恢复默认会清空本地覆盖', async () => {
    stubFetch({ accent: 'emerald' })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent: 'rose' }))

    render(
      <ThemeProvider>
        <Probe />
        <ThemePanel />
      </ThemeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('accent').textContent).toBe('rose')
    })

    fireEvent.click(screen.getByRole('button', { name: '主题' }))
    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))

    await waitFor(() => {
      expect(screen.getByTestId('accent').textContent).toBe('emerald')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run src/theme/ThemeProvider.test.tsx 2>&1 | grep -E "Failed to resolve|failed" | head -3
```

预期：FAIL，无法解析 `./ThemeProvider`。

- [ ] **Step 3: 实现应用器**

`frontend/src/theme/apply.ts`：

```ts
import type { ResolvedTheme } from './types'
import { toCssVars } from './resolve'

export function applyTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  for (const [key, value] of Object.entries(toCssVars(theme))) {
    root.style.setProperty(key, value)
  }
  root.dataset.mode = theme.effectiveMode
}
```

- [ ] **Step 4: 实现 Provider**

`frontend/src/theme/ThemeProvider.tsx`：

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { applyTheme } from './apply'
import { DEFAULT_PRESET_ID, getPreset } from './presets'
import { resolveTheme, sanitizePatch } from './resolve'
import type { ResolvedTheme, ThemeConfig, ThemePatch } from './types'

const STORAGE_KEY = 'personal-stack.theme.v1'

type ThemeContextValue = {
  config: ThemeConfig
  resolved: ResolvedTheme
  siteDefault: ThemePatch | null
  setOverride: (patch: ThemePatch) => void
  resetOverride: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readOverride(): ThemePatch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const patch = sanitizePatch(JSON.parse(raw))
    return Object.keys(patch).length > 0 ? patch : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [siteDefault, setSiteDefault] = useState<ThemePatch | null>(null)
  const [override, setOverrideState] = useState<ThemePatch | null>(() => readOverride())
  const [prefersDark, setPrefersDark] = useState(() => systemPrefersDark())

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/theme')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bad status'))))
      .then((data) => {
        if (cancelled) return
        const patch = sanitizePatch(data?.theme)
        setSiteDefault(Object.keys(patch).length > 0 ? patch : null)
      })
      .catch(() => {
        if (!cancelled) setSiteDefault(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  const resolved = useMemo(
    () => resolveTheme(getPreset(DEFAULT_PRESET_ID), siteDefault, override, prefersDark),
    [siteDefault, override, prefersDark],
  )

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setOverride = useCallback((patch: ThemePatch) => {
    setOverrideState((current) => {
      const next = { ...(current ?? {}), ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetOverride = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setOverrideState(null)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ config: resolved.config, resolved, siteDefault, setOverride, resetOverride }),
    [resolved, siteDefault, setOverride, resetOverride],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用')
  }
  return context
}
```

- [ ] **Step 5: 实现面板**

`frontend/src/theme/ThemePanel.tsx`：

```tsx
import { useState } from 'react'

import { ACCENTS, GRADIENT_PRESETS, MESH_PRESETS } from './types'
import type { Accent, BackgroundType, ThemeMode } from './types'
import { ACCENT_COLORS, BACKGROUND_CSS, PRESETS } from './presets'
import { useTheme } from './ThemeProvider'

const MODE_LABELS: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

const ACCENT_LABELS: Record<Accent, string> = {
  violet: 'Violet',
  blue: 'Blue',
  emerald: 'Emerald',
  rose: 'Rose',
  amber: 'Amber',
  slate: 'Slate',
}

const BACKGROUND_OPTIONS: Array<{ type: BackgroundType; value: string; label: string }> = [
  ...GRADIENT_PRESETS.map((preset) => ({
    type: 'gradient' as BackgroundType,
    value: preset,
    label: preset === 'aurora' ? 'Aurora' : preset === 'daylight' ? 'Daylight' : 'Dusk',
  })),
  ...MESH_PRESETS.map((preset) => ({
    type: 'mesh' as BackgroundType,
    value: preset,
    label: preset === 'mesh-violet' ? 'Mesh Violet' : 'Mesh Emerald',
  })),
  { type: 'solid', value: '#0b0b0f', label: '纯色' },
]

export function ThemePanel() {
  const { config, setOverride, resetOverride } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        type="button"
        aria-label="主题"
        onClick={() => setOpen((value) => !value)}
        className="rounded-card border border-border bg-surface px-4 py-2 text-sm text-fg shadow-card backdrop-blur-card"
      >
        主题
      </button>

      {open && (
        <div className="mt-3 w-72 rounded-card border border-border bg-surface p-4 text-sm text-fg shadow-card backdrop-blur-card">
          <p className="mb-2 text-muted">主题预设</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setOverride({ accent: preset.accent, radius: preset.radius, blur: preset.blur, background: preset.background })}
                className="rounded-card border border-border px-2 py-1 text-xs"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="mb-2 text-muted">明暗</p>
          <div className="mb-4 flex gap-2">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={config.mode === mode}
                onClick={() => setOverride({ mode })}
                className="rounded-card border border-border px-2 py-1 text-xs aria-pressed:bg-accent aria-pressed:text-accent-fg"
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          <p className="mb-2 text-muted">主色</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                aria-label={ACCENT_LABELS[accent]}
                aria-pressed={config.accent === accent}
                onClick={() => setOverride({ accent })}
                className="h-7 w-7 rounded-full border border-border aria-pressed:ring-2 aria-pressed:ring-accent"
                style={{ backgroundColor: ACCENT_COLORS[accent].accent }}
              />
            ))}
          </div>

          <label className="mb-3 block">
            <span className="text-muted">圆角 {config.radius}px</span>
            <input
              type="range"
              min={0}
              max={28}
              value={config.radius}
              aria-label="圆角"
              onChange={(event) => setOverride({ radius: Number(event.target.value) })}
              className="w-full"
            />
          </label>

          <label className="mb-4 block">
            <span className="text-muted">模糊 {config.blur}px</span>
            <input
              type="range"
              min={0}
              max={24}
              value={config.blur}
              aria-label="模糊"
              onChange={(event) => setOverride({ blur: Number(event.target.value) })}
              className="w-full"
            />
          </label>

          <p className="mb-2 text-muted">背景</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={`${option.type}-${option.value}`}
                type="button"
                onClick={() => setOverride({ background: { type: option.type, value: option.value } })}
                className="rounded-card border border-border px-2 py-1 text-xs"
                style={
                  option.type === 'solid'
                    ? { backgroundColor: option.value }
                    : { backgroundImage: BACKGROUND_CSS[option.value] ?? 'none' }
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetOverride}
            className="w-full rounded-card border border-border px-3 py-2 text-xs"
          >
            恢复默认
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: 实现背景层与卡片**

`frontend/src/components/ui/BackgroundLayer.tsx`：

```tsx
export function BackgroundLayer() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundColor: 'var(--bg)',
          backgroundImage: 'var(--bg-image)',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: 'var(--bg-overlay)' }}
      />
    </>
  )
}
```

`frontend/src/components/ui/Surface.tsx`：

```tsx
import type { HTMLAttributes } from 'react'

export function Surface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-border bg-surface shadow-card backdrop-blur-card ${className}`.trim()}
      {...props}
    />
  )
}
```

- [ ] **Step 7: App 包裹 Provider 与背景层**

`frontend/src/App.tsx` 在 `AuthProvider` 外增加 `ThemeProvider`，并在 `Routes` 之前渲染 `<BackgroundLayer />`：

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { BackgroundLayer } from './components/ui/BackgroundLayer'
import { ThemePanel } from './theme/ThemePanel'
import { ThemeProvider } from './theme/ThemeProvider'
import AdminPostsPage from './pages/AdminPostsPage'
import BlogListPage from './pages/BlogListPage'
import DrivePage from './pages/DrivePage'
import LoginPage from './pages/LoginPage'
import PostDetailPage from './pages/PostDetailPage'
import PostFormPage from './pages/PostFormPage'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundLayer />
          <Routes>
            <Route path="/" element={<BlogListPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/posts/:slug" element={<PostDetailPage />} />
            <Route
              path="/drive"
              element={
                <ProtectedRoute>
                  <DrivePage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Navigate to="/admin/posts" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/posts"
              element={
                <ProtectedRoute>
                  <AdminPostsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/posts/new"
              element={
                <ProtectedRoute>
                  <PostFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/posts/:id/edit"
              element={
                <ProtectedRoute>
                  <PostFormPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          <ThemePanel />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
```

（`/` 暂时仍指向 `BlogListPage`，Task 5 再换为 `HomeGate`。）

- [ ] **Step 8: 运行测试与构建**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run && npm run build"
```

预期：`ThemeProvider` 3 个测试通过，其余测试与构建通过。

- [ ] **Step 9: 提交**

```bash
git add frontend/src
git commit -m "feat: 主题运行时（Provider、面板、背景层与毛玻璃卡片）"
```

---

### Task 4: 后端 settings 模块与迁移 0004

**Files:**
- Create: `backend/app/modules/settings/__init__.py`
- Create: `backend/app/modules/settings/models.py`
- Create: `backend/app/modules/settings/schemas.py`
- Create: `backend/app/modules/settings/service.py`
- Create: `backend/app/modules/settings/router.py`
- Create: `backend/alembic/versions/0004_create_site_settings.py`
- Modify: `backend/alembic/env.py`（注册模型）
- Modify: `backend/app/main.py`（装配路由）
- Test: `backend/tests/test_settings_api.py`

**Interfaces:**
- Consumes: M1 的 `get_current_user`、`get_db`、`AppError` 与测试 fixture。
- Produces:
  - `SiteSetting`（表 `site_settings`：key PK / value JSON / updated_at）
  - `ThemeConfig`（`extra="forbid"`，字段与前端 schema 一致）、`ThemePatch`（全可选）、`ThemeOut`
  - `service.get_theme(session) -> ThemeConfig`、`service.update_theme(session, patch: ThemePatch) -> ThemeConfig`（局部合并）
  - `GET /api/settings/theme`（公开）、`PUT /api/admin/settings/theme`（需登录）

- [ ] **Step 1: 写失败测试**

`backend/tests/test_settings_api.py`：

```python
from app.core.security import create_access_token, hash_password
from app.modules.auth.models import User
from app.modules.settings.schemas import ThemeConfig


async def test_public_theme_requires_no_auth(client):
    response = await client.get("/api/settings/theme")

    assert response.status_code == 200
    body = response.json()["theme"]
    assert body["mode"] == "system"
    assert body["accent"] == "violet"
    assert body["radius"] == 16
    assert body["blur"] == 12
    assert body["background"] == {"type": "gradient", "value": "aurora"}


async def test_admin_theme_requires_auth(client):
    response = await client.put("/api/admin/settings/theme", json={"accent": "rose"})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_partial_update_merges_and_persists(client, db_session):
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))

    updated = await client.put(
        "/api/admin/settings/theme",
        json={"accent": "emerald", "radius": 6, "background": {"type": "mesh", "value": "mesh-emerald"}},
    )

    assert updated.status_code == 200
    body = updated.json()["theme"]
    assert body["accent"] == "emerald"
    assert body["radius"] == 6
    assert body["blur"] == 12
    assert body["background"] == {"type": "mesh", "value": "mesh-emerald"}

    fetched = await client.get("/api/settings/theme")
    assert fetched.json()["theme"]["accent"] == "emerald"


async def test_invalid_values_rejected(client, db_session):
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))

    bad_accent = await client.put("/api/admin/settings/theme", json={"accent": "neon"})
    assert bad_accent.status_code == 422
    assert bad_accent.json()["code"] == "validation_error"

    bad_radius = await client.put("/api/admin/settings/theme", json={"radius": 99})
    assert bad_radius.status_code == 422

    bad_solid = await client.put(
        "/api/admin/settings/theme",
        json={"background": {"type": "solid", "value": "red"}},
    )
    assert bad_solid.status_code == 422

    unknown_field = await client.put("/api/admin/settings/theme", json={"foo": "bar"})
    assert unknown_field.status_code == 422


def test_default_theme_matches_frontend_schema():
    theme = ThemeConfig()

    assert theme.model_dump() == {
        "mode": "system",
        "accent": "violet",
        "radius": 16,
        "blur": 12,
        "background": {"type": "gradient", "value": "aurora"},
    }
```

- [ ] **Step 2: 运行确认失败**

```bash
cd backend && .venv/bin/python -m pytest tests/test_settings_api.py -v
```

预期：FAIL，`ModuleNotFoundError: No module named 'app.modules.settings'`。

- [ ] **Step 3: 实现模型**

`backend/app/modules/settings/__init__.py`：空文件。

`backend/app/modules/settings/models.py`：

```python
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SiteSetting(Base):
    __tablename__ = "site_settings"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    __mapper_args__ = {"eager_defaults": True}

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 4: 实现 schema**

`backend/app/modules/settings/schemas.py`：

```python
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Accent = Literal["violet", "blue", "emerald", "rose", "amber", "slate"]
ThemeMode = Literal["light", "dark", "system"]
BackgroundType = Literal["solid", "gradient", "mesh"]

_GRADIENT_PRESETS = {"aurora", "daylight", "dusk"}
_MESH_PRESETS = {"mesh-violet", "mesh-emerald"}
_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class BackgroundConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: BackgroundType
    value: str

    @model_validator(mode="after")
    def validate_value(self) -> "BackgroundConfig":
        if self.type == "solid":
            if not _HEX_RE.fullmatch(self.value):
                raise ValueError("solid 背景必须是十六进制色值")
        elif self.type == "gradient":
            if self.value not in _GRADIENT_PRESETS:
                raise ValueError("未知的渐变预设")
        elif self.value not in _MESH_PRESETS:
            raise ValueError("未知的 mesh 预设")
        return self


class ThemeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ThemeMode = "system"
    accent: Accent = "violet"
    radius: int = Field(default=16, ge=0, le=28)
    blur: int = Field(default=12, ge=0, le=24)
    background: BackgroundConfig = BackgroundConfig(type="gradient", value="aurora")


class ThemePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ThemeMode | None = None
    accent: Accent | None = None
    radius: int | None = Field(default=None, ge=0, le=28)
    blur: int | None = Field(default=None, ge=0, le=24)
    background: BackgroundConfig | None = None


class ThemeOut(BaseModel):
    theme: ThemeConfig
```

- [ ] **Step 5: 实现服务与路由**

`backend/app/modules/settings/service.py`：

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.settings.models import SiteSetting
from app.modules.settings.schemas import ThemeConfig, ThemePatch

THEME_KEY = "theme"


async def _get_row(session: AsyncSession, key: str) -> SiteSetting | None:
    return (
        await session.execute(select(SiteSetting).where(SiteSetting.key == key))
    ).scalar_one_or_none()


async def get_theme(session: AsyncSession) -> ThemeConfig:
    row = await _get_row(session, THEME_KEY)
    if row is None:
        raise AppError("not_found", "主题配置不存在", 404)
    return ThemeConfig.model_validate(row.value)


async def update_theme(session: AsyncSession, patch: ThemePatch) -> ThemeConfig:
    row = await _get_row(session, THEME_KEY)
    current = ThemeConfig.model_validate(row.value) if row else ThemeConfig()
    merged = current.model_dump()
    merged.update(patch.model_dump(exclude_unset=True, exclude_none=True))
    theme = ThemeConfig.model_validate(merged)
    if row is None:
        session.add(SiteSetting(key=THEME_KEY, value=theme.model_dump()))
    else:
        row.value = theme.model_dump()
    await session.commit()
    return theme
```

`backend/app/modules/settings/router.py`：

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.deps import get_current_user
from app.modules.settings import service
from app.modules.settings.schemas import ThemeOut, ThemePatch

public_router = APIRouter(prefix="/api/settings", tags=["settings"])
admin_router = APIRouter(
    prefix="/api/admin/settings", tags=["settings-admin"], dependencies=[Depends(get_current_user)]
)


@public_router.get("/theme", response_model=ThemeOut)
async def get_theme(session: AsyncSession = Depends(get_db)) -> ThemeOut:
    return ThemeOut(theme=await service.get_theme(session))


@admin_router.put("/theme", response_model=ThemeOut)
async def update_theme(
    payload: ThemePatch, session: AsyncSession = Depends(get_db)
) -> ThemeOut:
    return ThemeOut(theme=await service.update_theme(session, payload))
```

- [ ] **Step 6: 迁移与装配**

`backend/alembic/versions/0004_create_site_settings.py`：

```python
"""create site_settings table

Revision ID: 0004_create_site_settings
Revises: 0003_create_storage
Create Date: 2026-09-21
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_create_site_settings"
down_revision = "0003_create_storage"
branch_labels = None
depends_on = None

DEFAULT_THEME = {
    "mode": "system",
    "accent": "violet",
    "radius": 16,
    "blur": 12,
    "background": {"type": "gradient", "value": "aurora"},
}


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_site_settings")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    settings_table = sa.table(
        "site_settings",
        sa.column("key", sa.String),
        sa.column("value", sa.JSON),
    )
    op.bulk_insert(settings_table, [{"key": "theme", "value": DEFAULT_THEME}])


def downgrade() -> None:
    op.drop_table("site_settings")
```

`backend/alembic/env.py` 增加：

```python
from app.modules.settings import models as settings_models  # noqa: F401  注册模型元数据
```

`backend/app/main.py` 增加导入与注册（保留既有）：

```python
from app.modules.settings.router import admin_router as settings_admin_router
from app.modules.settings.router import public_router as settings_public_router
```

```python
app.include_router(settings_public_router)
app.include_router(settings_admin_router)
```

- [ ] **Step 7: 运行确认通过**

```bash
cd backend && .venv/bin/python -m pytest tests/test_settings_api.py -v && make check-backend
```

预期：5 个新测试通过，全套通过。

- [ ] **Step 8: 提交**

```bash
git add backend/app/modules/settings backend/alembic backend/app/main.py backend/tests/test_settings_api.py
git commit -m "feat: 站点设置模块与主题配置接口（迁移 0004）"
```

---

### Task 5: AppShell、HomeGate 与控制台

**Files:**
- Create: `frontend/src/components/ui/AppShell.tsx`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/pages/HomeGate.tsx`
- Create: `frontend/src/pages/ConsolePage.tsx`
- Create: `frontend/src/pages/HomeGate.test.tsx`
- Create: `frontend/src/pages/ConsolePage.test.tsx`
- Modify: `frontend/src/App.tsx`（`/` → `HomeGate`）
- Delete: `frontend/src/components/AdminHeader.tsx`（并入 AppShell 用户菜单；其引用在 Task 6 一并清理）

**Interfaces:**
- Consumes: Task 2/3 的主题与 UI 组件；M1 的 `useAuth`；现有列表/用量接口。
- Produces:
  - `Button`（variant: `primary|ghost`）
  - `AppShell({ children, title? })`：顶栏 + 内容容器 + 用户菜单（登录/退出/管理入口）
  - `HomeGate`：`useAuth().user` 为 null → `BlogListPage`，否则 → `ConsolePage`
  - `ConsolePage`：统计卡（文章数/文件数/已用空间）+ 两张入口卡

- [ ] **Step 1: 写失败测试**

`frontend/src/pages/HomeGate.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeProvider'
import HomeGate from './HomeGate'

function stubFetch(loggedIn: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/me') {
        return Promise.resolve(
          loggedIn
            ? Response.json({ id: 1, username: 'admin' })
            : new Response('', { status: 401 }),
        )
      }
      if (url.startsWith('/api/settings/theme')) {
        return Promise.resolve(Response.json({ theme: {} }))
      }
      if (url.startsWith('/api/admin/posts')) {
        return Promise.resolve(
          Response.json({ items: [], total: 7, page: 1, page_size: 20 }),
        )
      }
      if (url.startsWith('/api/storage/usage')) {
        return Promise.resolve(Response.json({ used_bytes: 1048576, file_count: 3 }))
      }
      if (url.startsWith('/api/posts')) {
        return Promise.resolve(Response.json({ items: [], total: 0, page: 1, page_size: 20 }))
      }
      if (url.startsWith('/api/tags')) {
        return Promise.resolve(Response.json([]))
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function renderGate() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <HomeGate />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('HomeGate', () => {
  it('未登录显示博客列表', async () => {
    stubFetch(false)

    renderGate()

    expect(await screen.findByText('还没有发布文章')).toBeInTheDocument()
  })

  it('已登录显示控制台与两个入口', async () => {
    stubFetch(true)

    renderGate()

    expect(await screen.findByText('博客管理')).toBeInTheDocument()
    expect(screen.getByText('我的网盘')).toBeInTheDocument()
    expect(await screen.findByText('7')).toBeInTheDocument()
  })
})
```

`frontend/src/pages/ConsolePage.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeProvider'
import ConsolePage from './ConsolePage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ConsolePage', () => {
  it('展示统计与入口', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/auth/me') {
          return Promise.resolve(Response.json({ id: 1, username: 'admin' }))
        }
        if (url.startsWith('/api/settings/theme')) {
          return Promise.resolve(Response.json({ theme: {} }))
        }
        if (url.startsWith('/api/admin/posts')) {
          return Promise.resolve(Response.json({ items: [], total: 7, page: 1, page_size: 20 }))
        }
        if (url.startsWith('/api/storage/usage')) {
          return Promise.resolve(Response.json({ used_bytes: 10485760, file_count: 3 }))
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <ConsolePage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('10.0 MB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /博客管理/ })).toHaveAttribute('href', '/admin/posts')
    expect(screen.getByRole('link', { name: /我的网盘/ })).toHaveAttribute('href', '/drive')
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run src/pages/HomeGate.test.tsx 2>&1 | grep -E "Failed to resolve|failed" | head -3
```

预期：FAIL。

- [ ] **Step 3: 实现 Button 与 AppShell**

`frontend/src/components/ui/Button.tsx`：

```tsx
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
}

export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const base = 'rounded-card px-3 py-2 text-sm transition-colors disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-fg hover:opacity-90'
      : 'border border-border text-fg hover:bg-surface'
  return <button className={`${base} ${styles} ${className}`.trim()} {...props} />
}
```

`frontend/src/components/ui/AppShell.tsx`：

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import { Button } from './Button'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface backdrop-blur-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight text-fg">
            personal-stack
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted md:flex">
            <Link to="/blog" className="hover:text-fg">博客</Link>
            <Link to="/drive" className="hover:text-fg">网盘</Link>
            {user && <Link to="/admin/posts" className="hover:text-fg">管理</Link>}
            {user ? (
              <Button onClick={handleLogout}>退出（{user.username}）</Button>
            ) : (
              <Link to="/login" className="hover:text-fg">登录</Link>
            )}
          </nav>

          <button
            type="button"
            aria-label="菜单"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-card border border-border px-3 py-1 text-sm md:hidden"
          >
            菜单
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm md:hidden">
            <Link to="/blog" onClick={() => setMenuOpen(false)}>博客</Link>
            <Link to="/drive" onClick={() => setMenuOpen(false)}>网盘</Link>
            {user && <Link to="/admin/posts" onClick={() => setMenuOpen(false)}>管理</Link>}
            {user ? (
              <button type="button" onClick={handleLogout} className="text-left">退出（{user.username}）</button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)}>登录</Link>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: 实现 HomeGate 与控制台**

`frontend/src/pages/HomeGate.tsx`：

```tsx
import { useAuth } from '../auth/AuthContext'
import BlogListPage from './BlogListPage'
import ConsolePage from './ConsolePage'

export default function HomeGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="text-muted">加载中...</p>
  }
  return user ? <ConsolePage /> : <BlogListPage />
}
```

`frontend/src/pages/ConsolePage.tsx`：

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listAdminPosts } from '../api/blog'
import { fetchUsage } from '../api/storage'
import { useAuth } from '../auth/AuthContext'
import { Surface } from '../components/ui/Surface'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function ConsolePage() {
  const { user } = useAuth()
  const [postCount, setPostCount] = useState<number | null>(null)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [usedBytes, setUsedBytes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminPosts({})
      .then((data) => {
        if (!cancelled) setPostCount(data.total)
      })
      .catch(() => undefined)
    fetchUsage()
      .then((usage) => {
        if (cancelled) return
        setFileCount(usage.file_count)
        setUsedBytes(usage.used_bytes)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">你好，{user?.username}</h1>
        <p className="mt-1 text-sm text-muted">欢迎回到 personal-stack</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Surface className="p-5">
          <p className="text-sm text-muted">文章</p>
          <p className="mt-2 text-3xl font-semibold">{postCount ?? '—'}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-sm text-muted">文件</p>
          <p className="mt-2 text-3xl font-semibold">{fileCount ?? '—'}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-sm text-muted">已用空间</p>
          <p className="mt-2 text-3xl font-semibold">
            {usedBytes === null ? '—' : formatSize(usedBytes)}
          </p>
        </Surface>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/admin/posts" className="block">
          <Surface className="h-full p-6 transition-opacity hover:opacity-90">
            <h2 className="text-lg font-semibold">博客管理</h2>
            <p className="mt-2 text-sm text-muted">写文章、管理标签与草稿</p>
          </Surface>
        </Link>
        <Link to="/drive" className="block">
          <Surface className="h-full p-6 transition-opacity hover:opacity-90">
            <h2 className="text-lg font-semibold">我的网盘</h2>
            <p className="mt-2 text-sm text-muted">上传、下载与管理文件</p>
          </Surface>
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: 路由切换到 HomeGate**

`frontend/src/App.tsx` 中把 `<Route path="/" element={<BlogListPage />} />` 改为 `<Route path="/" element={<HomeGate />} />`，并增加 `import HomeGate from './pages/HomeGate'`（`/blog` 仍指向 `BlogListPage`）。

- [ ] **Step 6: 运行测试与构建**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run && npm run build"
```

预期：新增用例通过；其余通过（个别既有测试可能因 `AdminHeader` 仍被引用而正常）。

- [ ] **Step 7: 提交**

```bash
git add frontend/src
git commit -m "feat: 应用外壳、访客/登录双形态首页与控制台"
```

---

### Task 6: 现有页面视觉迁移

**Files:**
- Modify: `frontend/src/pages/BlogListPage.tsx`
- Modify: `frontend/src/pages/PostDetailPage.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/AdminPostsPage.tsx`
- Modify: `frontend/src/pages/PostFormPage.tsx`
- Modify: `frontend/src/pages/DrivePage.tsx`
- Modify: `frontend/src/components/MarkdownView.tsx`
- Modify: 受影响的既有测试（`BlogListPage.test.tsx`、`PostDetailPage.test.tsx`、`LoginPage.test.tsx`、`AdminPostsPage.test.tsx`、`PostFormPage.test.tsx`、`DrivePage.test.tsx`）
- Delete: `frontend/src/components/AdminHeader.tsx`
- Create: `deploy/tests/test_no_hardcoded_colors.sh`

**Interfaces:**
- Consumes: Task 3/5 的 `AppShell`/`Surface`/`Button`/token 工具类。
- Produces: 六个页面统一外观；既有测试适配新标记。

- [ ] **Step 1: BlogListPage 迁移**

`frontend/src/pages/BlogListPage.tsx` 的返回结构改为（保留取数逻辑与文案）：

```tsx
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">博客</h1>
          <nav className="flex flex-wrap gap-2">
            <Button onClick={() => selectTag(null)} disabled={tag === null}>全部</Button>
            {tags.map((item) => (
              <Button key={item.slug} onClick={() => selectTag(item.slug)} disabled={tag === item.slug}>
                {item.name}
              </Button>
            ))}
          </nav>
        </header>

        {loading && <p className="text-muted">加载中...</p>}
        {error !== '' && <p role="alert" className="text-accent">{error}</p>}
        {!loading && posts.length === 0 && <p className="text-muted">还没有发布文章</p>}

        <div className="grid gap-4">
          {posts.map((post) => (
            <Surface key={post.id} className="p-6">
              <h2 className="text-lg font-semibold">
                <Link to={`/posts/${post.slug}`} className="hover:text-accent">{post.title}</Link>
              </h2>
              {post.published_at && <time className="mt-1 block text-xs text-muted">{post.published_at.slice(0, 10)}</time>}
              {post.summary && <p className="mt-3 text-sm text-muted">{post.summary}</p>}
              <p className="mt-3 flex gap-3 text-xs">
                {post.tags.map((item) => (
                  <Link key={item.slug} to={`/?tag=${encodeURIComponent(item.slug)}`} className="text-accent hover:opacity-80">
                    {item.name}
                  </Link>
                ))}
              </p>
            </Surface>
          ))}
        </div>

        {totalPages > 1 && (
          <footer className="flex items-center justify-center gap-4 text-sm">
            <Button onClick={() => gotoPage(page - 1)} disabled={page <= 1}>上一页</Button>
            <span className="text-muted">第 {page} / {totalPages} 页</span>
            <Button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>下一页</Button>
          </footer>
        )}
      </section>
    </AppShell>
  )
```

并增加导入：

```tsx
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'
```

- [ ] **Step 2: PostDetailPage 迁移**

返回结构改为：

```tsx
  return (
    <AppShell>
      <article className="space-y-6">
        <Link to="/blog" className="text-sm text-muted hover:text-fg">← 返回列表</Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          {post.published_at && <time className="text-xs text-muted">{post.published_at.slice(0, 10)}</time>}
          <p className="flex gap-3 text-xs">
            {post.tags.map((tag) => (
              <Link key={tag.slug} to={`/?tag=${encodeURIComponent(tag.slug)}`} className="text-accent hover:opacity-80">
                {tag.name}
              </Link>
            ))}
          </p>
        </header>
        <Surface className="p-6 md:p-8">
          <MarkdownView content={post.content_md} />
        </Surface>
      </article>
    </AppShell>
  )
```

加载/错误分支改为 `<AppShell><p className="text-muted">加载中...</p></AppShell>` 与 `<AppShell><p role="alert" className="text-accent">{error || '文章不存在'}</p></AppShell>`；增加对应导入。

- [ ] **Step 3: LoginPage 迁移**

`<main>` 结构改为（表单字段与测试用 label 不变）：

```tsx
  return (
    <AppShell>
      <Surface className="mx-auto mt-10 w-full max-w-sm p-6">
        <h1 className="mb-4 text-xl font-semibold">登录</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>
          {error !== '' && <p role="alert" className="text-sm text-accent">{error}</p>}
          <Button type="submit" variant="primary" className="w-full">登录</Button>
        </form>
      </Surface>
    </AppShell>
  )
```

- [ ] **Step 4: AdminPostsPage 迁移**

- 删除 `AdminHeader` 导入与使用，整页包在 `<AppShell>` 中
- 筛选按钮改 `Button`、表格包在 `Surface` 内并加 `w-full text-left text-sm` 样式；状态徽章用 `rounded-card border border-border px-2 py-0.5 text-xs text-muted`
- 「新建文章」「编辑」保持 `Link`；「删除」用 `Button`
- 空态与错误文案沿用；加载态 `text-muted`

- [ ] **Step 5: PostFormPage 迁移**

- 删除 `AdminHeader`，包 `<AppShell>`；表单包 `Surface`，`label` 结构改为 `<span className="text-muted">字段名</span><input className="mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2" .../>`（保留原有 label 文案与 `aria-label="正文"` 的 mock 结构）
- 保存按钮 `variant="primary"`；错误 `role="alert"` 文案不变

- [ ] **Step 6: DrivePage 迁移**

- 包 `<AppShell>`；面包屑与操作按钮用 `Button`；列表包 `Surface`，表格行用 `border-b border-border last:border-0`；大小与用量文案不变；上传 input 保持 `aria-label="上传文件"`；「删除 文件名」「删除文件夹 名字」按钮文案不变（测试依赖）

- [ ] **Step 7: MarkdownView 排版**

`frontend/src/components/MarkdownView.tsx` 的容器 className 改为：

```tsx
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-accent prose-code:rounded prose-code:bg-bg/50 prose-code:px-1 prose-pre:rounded-card prose-pre:border prose-pre:border-border">
```

- [ ] **Step 8: 删除 AdminHeader 并适配既有测试**

```bash
rm frontend/src/components/AdminHeader.tsx
grep -rn "AdminHeader" frontend/src || echo "no references"
```

对既有测试的适配原则：文案与 `role`/`label` 不变，仅当断言依赖具体标签（如 `<table>`、`<header>`）时同步调整；逐个运行并修复：

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm test -- --run 2>&1 | grep -E "Test Files|Tests |failed" | head -5
```

- [ ] **Step 9: 防写死颜色断言**

`deploy/tests/test_no_hardcoded_colors.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

# 组件与页面里不得出现十六进制色值（主题变量除外）
if grep -rnE "#[0-9a-fA-F]{3,6}\b" frontend/src/pages frontend/src/components \
  | grep -vE "frontend/src/theme|styles/index.css" >/dev/null; then
  grep -rnE "#[0-9a-fA-F]{3,6}\b" frontend/src/pages frontend/src/components | head -5
  fail "存在写死的十六进制色值"
else
  pass "无写死色值"
fi

exit $FAIL
```

运行：

```bash
chmod +x deploy/tests/test_no_hardcoded_colors.sh
bash deploy/tests/test_no_hardcoded_colors.sh
```

- [ ] **Step 10: 全量验证与提交**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run && npm run build"
bash deploy/tests/test_no_hardcoded_colors.sh
git add -A frontend deploy/tests/test_no_hardcoded_colors.sh
git commit -m "feat: 页面迁移到毛玻璃卡片界面"
```

---

### Task 7: 部署教学文档

**Files:**
- Create: `docs/deployment-tutorial.md`

**Interfaces:**
- Consumes: 仓库内既有脚本与文档（`deploy/ops/*`、`docs/operations.md`、`docs/deploy-notes.md`、各实施计划）。
- Produces: 面向新机器的从零部署教程。

- [ ] **Step 1: 撰写教程**

`docs/deployment-tutorial.md` 必须包含以下章节与内容（每节含可直接复制的命令与「预期输出」）：

1. **拓扑与前置**：单机 + Cloudflare Tunnel 架构图；需要的东西（一台 Linux、Docker、一个域名与 Cloudflare 账号、GitHub 账号）
2. **系统准备**：Rocky/RHEL 系示例；`deploy/ops/host/install-docker.sh` 用法；镜像加速与日志轮转（`deploy/ops/host/daemon.json`）说明；firewalld（`firewalld.sh`）说明；创建 `data/files` 与 swap 的注意事项
3. **代码与密钥**：SSH 部署密钥生成、GitHub 仓库与 Deploy Key（含 `ssh.github.com:443` 迂回）、`.env` 生成（列出所有键与含义，强调强随机与 600 权限）
4. **首次部署**：生产目录布局、`deploy-release.sh`（或 compose 直跑）步骤、迁移与种子、验证命令
5. **公网接入**：Cloudflare Tunnel 创建、Public Hostname → `HTTP caddy:80`、真实客户端 IP 三段链路（cloudflared → Caddy `trusted_proxies_strict` → uvicorn `--proxy-headers`）与验证方法
6. **CI/CD**：GHCR 镜像、自托管 Runner（`install-runner.sh`，非 root，API 资产下载与镜像回退）、自动部署与回滚语义、演练方法
7. **监控**：Prometheus/Grafana 启用（`ENABLE_MONITORING`）、口令与 basic auth（`$$` 转义）、抓取目标检查
8. **备份与恢复**：timer 安装、产物与保留、`restore.sh` 用法、演练步骤
9. **安全加固**：清单与现状（fail2ban、容器加固、HSTS/CSP、digest 固定、SSH 密钥化建议）
10. **故障排查**：把真实坑写进去 —— GitHub HTTPS 不可达、GHCR 拉取慢、`github.com` 克隆失败、SELinux 与 rsync、compose 项目名误删生产、`$$` 转义、CSP 与 Cloudflare 信标、Cloudflare 1016/1034、MySQL `caching_sha2_password`、async 关系加载等
11. **命令速查**：仓库内所有运维脚本与 Makefile 目标一览

- [ ] **Step 2: 校验命令与脚本一致**

```bash
for f in deploy/ops/deploy-release.sh deploy/ops/host/install-docker.sh deploy/ops/host/install-runner.sh deploy/ops/host/firewalld.sh deploy/ops/host/fail2ban.sh deploy/ops/backup/backup-db.sh deploy/ops/backup/restore.sh; do
  test -f "$f" && grep -q "$(basename "$f")" docs/deployment-tutorial.md && echo "OK $f" || echo "MISSING $f"
done
```

预期：全部 OK（教程中引用的脚本都存在且被提及）。

- [ ] **Step 3: 提交**

```bash
git add docs/deployment-tutorial.md
git commit -m "docs: 从零部署教学文档"
```

---

### Task 8: API 接口手册

**Files:**
- Create: `docs/api-reference.md`

**Interfaces:**
- Consumes: 现有全部路由（auth/blog/storage/settings）。
- Produces: 可查阅的接口手册。

- [ ] **Step 1: 撰写手册**

`docs/api-reference.md` 结构：

1. **总览**：Base URL（生产 `https://stack.personal-stack.ltd`，开发 `http://localhost:8000`）；鉴权方式（httpOnly Cookie `access_token`，登录后自动携带）；错误响应统一格式 `{code, message}` 与常见状态码表；分页参数约定（`page` 默认 1、`page_size` 默认 20、上限 100）
2. **auth**：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` —— 请求/响应示例、Cookie 属性、限流行为（5 次/分钟 → 429）
3. **blog 公开**：`GET /api/posts`（`tag/page/page_size`，仅已发布）、`GET /api/posts/{slug}`、`GET /api/tags`
4. **blog 管理**：`GET/POST /api/admin/posts`、`GET/PUT/DELETE /api/admin/posts/{id}` —— 字段约束（title/slug/summary/content_md/status/tags、slug 正则、标签 ≤50 与 ≤20 个）、409 `slug_conflict`
5. **storage**：`GET/POST /api/folders`、`GET /api/folders/tree`、`PATCH/DELETE /api/folders/{id}`、`POST /api/files/upload`、`GET /api/files/{id}/download`、`PATCH/DELETE /api/files/{id}`、`GET /api/storage/usage` —— 上传限制（大小上限、409 同名、413 超限）、下载响应头（`Content-Disposition`、中文名编码）
6. **settings**：`GET /api/settings/theme`（公开）、`PUT /api/admin/settings/theme`（局部更新）—— 主题字段枚举与范围表
7. **调试入口**：开发环境 `/docs`（Swagger UI）与 `/openapi.json`；生产不暴露（Caddy 仅路由 `/api/*`）
8. **curl 示例集**：登录并保存 Cookie、发文章、上传下载、修改主题，每条可直接复制执行

- [ ] **Step 2: 校验与代码一致**

```bash
python3 - <<'PY'
import pathlib
import re

routers = pathlib.Path("backend/app/modules")
text = "\n".join(path.read_text() for path in routers.glob("*/router.py"))
prefixes = set(re.findall(r'APIRouter\(prefix="(/api[^"]*)"', text))
doc = pathlib.Path("docs/api-reference.md").read_text()
missing = sorted(prefix for prefix in prefixes if prefix not in doc)
print("缺失前缀：", missing)
PY
```

预期：输出 `缺失前缀： []`；若有缺失则把对应模块补进手册。

- [ ] **Step 3: 提交**

```bash
git add docs/api-reference.md
git commit -m "docs: 后端 API 接口手册"
```

---

### Task 9: 端到端验证与上线

**Files:**
- Modify: `README.md`（新增主题与控制台说明）
- Modify: `/root/user-tasks.md`（用户验证清单）

**Interfaces:**
- Consumes: Task 1–8 全部产物。
- Produces: 生产上线与用户确认。

- [ ] **Step 1: 本地全量验证**

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run && npm run build"
make check-backend
for t in deploy/tests/test_*.sh; do bash "$t" >/dev/null || echo "FAIL $t"; done
echo "local checks done"
```

预期：全绿。

- [ ] **Step 2: 推送并按既有流程上线**

```bash
git add README.md
git commit -m "docs: 主题与双形态首页说明"
git push
```

等待 Release → Deploy 成功；迁移 `0004` 随部署执行。

- [ ] **Step 3: 生产验证（curl 级）**

```bash
grep -q "stack.personal-stack.ltd" /etc/hosts || echo "104.21.0.1 stack.personal-stack.ltd" >> /etc/hosts
curl -sS https://stack.personal-stack.ltd/api/settings/theme
echo
curl -sS -o /dev/null -w "main: %{http_code}\n" https://stack.personal-stack.ltd/
sed -i '/stack.personal-stack.ltd/d' /etc/hosts
```

预期：返回 `{"theme":{...}}` 默认主题；主站 200。

- [ ] **Step 4: 用户操作——浏览器验证**

更新 `/root/user-tasks.md`，请用户确认：

1. 打开站点：未登录看到博客列表（毛玻璃卡片风格）；点开文章排版正常
2. 右下角「主题」：切换深/浅色与主色、拖动圆角/模糊、切换背景 → 全站即时变化；刷新后保留
3. 点「恢复默认」→ 回到你设置的站默认
4. 登录后：首页变为控制台（统计卡 + 博客管理/我的网盘两个入口）
5. 登录后台，在浏览器 devtools 里执行 `fetch('/api/admin/settings/theme', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({accent:'emerald', radius:6})})`，然后退出登录（或换无痕窗口）确认默认主题生效
6. 移动端宽度下导航折叠可用
7. 博客发布、网盘上传下载回归正常

- [ ] **Step 5: 记录上线结果**

在 `docs/deploy-notes.md` 追加 M7 上线记录（时间、release sha、验证结果），提交并推送：

```bash
git add docs/deploy-notes.md
git commit -m "docs: 记录 M7 上线与验证结果"
git push
```

---

## M7 完成定义（DoD）

1. 访客可切换主题（预设/明暗/主色/圆角/模糊/背景），刷新保留，「恢复默认」有效；后端不可用时用内置预设启动。
2. 后台可通过 `PUT /api/admin/settings/theme` 设置站默认，未自定义的访客下次访问生效。
3. 首屏无明暗闪烁；组件无写死色值（脚本断言通过）。
4. 未登录 `/` 为博客列表，`/blog` 固定为博客列表；登录后 `/` 为控制台（统计 + 两个入口）。
5. 六个既有页面完成视觉迁移且功能与文案不变；移动端可用。
6. `docs/deployment-tutorial.md` 与 `docs/api-reference.md` 完成并通过一致性校验。
7. 前后端测试全绿；生产浏览器验证通过；自动部署链路正常；CI 绿灯。
