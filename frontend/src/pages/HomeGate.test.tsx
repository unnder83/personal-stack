import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeProvider'
import HomeGate from './HomeGate'

function stubFetch(loggedIn: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/me') {
        return Promise.resolve(
          loggedIn
            ? Response.json({ id: 1, username: 'admin' })
            : new Response('', { status: 401 }),
        )
      }
      if (url.startsWith('/api/settings/theme')) {
        return Promise.resolve(Response.json({ theme: {} }))
      }
      if (url.startsWith('/api/admin/posts')) {
        return Promise.resolve(
          Response.json({ items: [], total: 7, page: 1, page_size: 20 }),
        )
      }
      if (url.startsWith('/api/storage/usage')) {
        return Promise.resolve(Response.json({ used_bytes: 1048576, file_count: 3 }))
      }
      if (url.startsWith('/api/posts')) {
        return Promise.resolve(Response.json({ items: [], total: 0, page: 1, page_size: 20 }))
      }
      if (url.startsWith('/api/tags')) {
        return Promise.resolve(Response.json([]))
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function renderGate() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <HomeGate />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('HomeGate', () => {
  it('未登录显示博客列表', async () => {
    stubFetch(false)

    renderGate()

    expect(await screen.findByText('还没有发布文章')).toBeInTheDocument()
  })

  it('已登录显示控制台与两个入口', async () => {
    stubFetch(true)

    renderGate()

    expect(await screen.findByText('博客管理')).toBeInTheDocument()
    expect(screen.getByText('我的网盘')).toBeInTheDocument()
    expect(await screen.findByText('7')).toBeInTheDocument()
  })
})
