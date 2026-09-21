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
  const allowed: readonly string[] =
    type === 'gradient' ? GRADIENT_PRESETS : MESH_PRESETS
  return allowed.includes(value)
    ? { type: type as BackgroundConfig['type'], value }
    : undefined
}

export function sanitizePatch(input: unknown): ThemePatch {
  if (!isRecord(input)) return {}
  const patch: ThemePatch = {}
  if (typeof input.mode === 'string' && (MODES as readonly string[]).includes(input.mode)) {
    patch.mode = input.mode as ThemeMode
  }
  if (
    typeof input.accent === 'string' &&
    (ACCENTS as readonly string[]).includes(input.accent)
  ) {
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

function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return hex
}

export function relativeLuminance(hex: string): number {
  const value = expandHex(hex).slice(1)
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
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
  let mode = effectiveMode(config.mode, prefersDark)
  if (config.background.type === 'solid') {
    // 纯色背景按亮度决定明暗，避免亮色底配暗色文字
    mode = relativeLuminance(config.background.value) > 0.4 ? 'light' : 'dark'
  }
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
      : (BACKGROUND_CSS[config.background.value] ?? 'none')
  return {
    '--bg': config.background.type === 'solid' ? config.background.value : palette.bg,
    '--surface': palette.surface,
    '--fg': palette.fg,
    '--fg-muted': palette.fgMuted,
    '--border': palette.border,
    '--shadow': palette.shadow,
    '--accent': ACCENT_COLORS[config.accent].accent,
    '--accent-fg': ACCENT_COLORS[config.accent].fg,
    '--accent-text':
      mode === 'light'
        ? ACCENT_COLORS[config.accent].textLight
        : ACCENT_COLORS[config.accent].textDark,
    '--radius': `${config.radius}px`,
    '--blur': `${config.blur}px`,
    '--bg-image': backgroundCss,
    '--bg-overlay': config.background.type === 'solid' ? 'transparent' : BACKGROUND_OVERLAY[mode],
  }
}
