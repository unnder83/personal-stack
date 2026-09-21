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
