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
