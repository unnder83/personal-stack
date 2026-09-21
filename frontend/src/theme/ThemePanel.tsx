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
                onClick={() =>
                  setOverride({
                    accent: preset.accent,
                    radius: preset.radius,
                    blur: preset.blur,
                    background: preset.background,
                  })
                }
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
                onClick={() =>
                  setOverride({ background: { type: option.type, value: option.value } })
                }
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
