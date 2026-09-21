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

export const ACCENT_COLORS: Record<
  Accent,
  { accent: string; fg: string; textLight: string; textDark: string }
> = {
  violet: { accent: '#7c3aed', fg: '#ffffff', textLight: '#6d28d9', textDark: '#c4b5fd' },
  blue: { accent: '#2563eb', fg: '#ffffff', textLight: '#1d4ed8', textDark: '#93c5fd' },
  emerald: { accent: '#047857', fg: '#ffffff', textLight: '#047857', textDark: '#6ee7b7' },
  rose: { accent: '#e11d48', fg: '#ffffff', textLight: '#be123c', textDark: '#fda4af' },
  amber: { accent: '#f59e0b', fg: '#2a1a02', textLight: '#b45309', textDark: '#fcd34d' },
  slate: { accent: '#475569', fg: '#ffffff', textLight: '#475569', textDark: '#cbd5e1' },
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
