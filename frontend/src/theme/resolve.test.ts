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

    expect(patch).toEqual({ accent: 'blue', blur: 24 })
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
