import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/me') return Promise.resolve(new Response('', { status: 401 }))
      if (url.startsWith('/api/settings/theme')) {
        return Promise.resolve(Response.json({ theme: {} }))
      }
      if (url.startsWith('/api/posts')) {
        return Promise.resolve(Response.json({ items: [], total: 0, page: 1, page_size: 20 }))
      }
      if (url.startsWith('/api/tags')) return Promise.resolve(Response.json([]))
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('App 路由', () => {
  it('未登录访问 / 显示博客列表', async () => {
    stubFetch()
    window.history.pushState({}, '', '/')

    render(<App />)

    expect(await screen.findByText('还没有发布文章')).toBeInTheDocument()
  })

  it('/blog 始终显示博客列表', async () => {
    stubFetch()
    window.history.pushState({}, '', '/blog')

    render(<App />)

    expect(await screen.findByText('还没有发布文章')).toBeInTheDocument()
  })
})
