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
