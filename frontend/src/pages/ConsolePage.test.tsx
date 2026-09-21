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
