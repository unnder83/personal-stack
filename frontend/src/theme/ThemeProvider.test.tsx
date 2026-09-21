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
        return Promise.resolve(Response.json({ theme: siteTheme }))
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
