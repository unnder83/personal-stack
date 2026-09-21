import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import BlogListPage from './BlogListPage'

function mockFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/me') {
        return Promise.resolve(new Response('', { status: 401 }))
      }
      for (const [prefix, body] of Object.entries(routes)) {
        if (url.startsWith(prefix)) {
          return Promise.resolve(
            new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BlogListPage', () => {
  it('展示文章列表与标签', async () => {
    mockFetch({
      '/api/tags': [{ id: 1, name: 'Python', slug: 'python' }],
      '/api/posts': {
        items: [
          {
            id: 1,
            title: '第一篇文章',
            slug: 'first',
            summary: '摘要内容',
            published_at: '2026-09-19T12:00:00',
            tags: [{ id: 1, name: 'Python', slug: 'python' }],
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <BlogListPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('第一篇文章')).toBeInTheDocument()
    expect(screen.getByText('摘要内容')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Python' })).toBeInTheDocument()
  })

  it('没有文章时显示空状态', async () => {
    mockFetch({
      '/api/tags': [],
      '/api/posts': { items: [], total: 0, page: 1, page_size: 20 },
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <BlogListPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('还没有发布文章')).toBeInTheDocument()
  })

  it('含特殊字符的标签链接正确编码', async () => {
    mockFetch({
      '/api/tags': [{ id: 1, name: 'C++', slug: 'c++' }],
      '/api/posts': {
        items: [
          {
            id: 1,
            title: '文章',
            slug: 'one',
            summary: null,
            published_at: '2026-09-19T12:00:00',
            tags: [{ id: 1, name: 'C++', slug: 'c++' }],
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <BlogListPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: 'C++' })
    expect(link).toHaveAttribute('href', '/?tag=c%2B%2B')
  })
})
