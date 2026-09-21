import { describe, expect, it } from 'vitest'

import { ACCENT_COLORS, getPreset } from './presets'
import { relativeLuminance } from './resolve'

function contrast(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

const preset = getPreset('vercel-dark')

describe('颜色对比度（WCAG AA 门槛 4.5）', () => {
  it('按钮文字与其底色达标', () => {
    for (const [name, colors] of Object.entries(ACCENT_COLORS)) {
      expect(contrast(colors.fg, colors.accent), `accent ${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('accent 文字在明暗底色上达标', () => {
    for (const [name, colors] of Object.entries(ACCENT_COLORS)) {
      expect(contrast(colors.textLight, preset.light.bg), `light ${name}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(colors.textDark, preset.dark.bg), `dark ${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
