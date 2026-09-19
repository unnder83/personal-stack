import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import AdminPostsPage from './AdminPostsPage'

function stubFetch(handlers: Array<[string, string, number, unknown]>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      for (const [m, prefix, status, body] of handlers) {
        if (m === method && url.startsWith(prefix)) {
          return Promise.resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }
      throw new Error(`unexpected fetch: ${method} ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/posts']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<h1>登录页</h1>} />
          <Route path="/admin/posts" element={<AdminPostsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AdminPostsPage', () => {
  it('展示文章并支持删除', async () => {
    stubFetch([
      ['GET', '/api/auth/me', 200, { id: 1, username: 'admin' }],
      [
        'GET',
        '/api/admin/posts',
        200,
        {
          items: [
            {
              id: 1,
              title: '文章一',
              slug: 'one',
              status: 'draft',
              published_at: null,
              updated_at: '2026-09-19T12:00:00',
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        },
      ],
      ['DELETE', '/api/admin/posts/1', 200, { status: 'ok' }],
    ])

    renderPage()

    expect(await screen.findByText('文章一')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/posts/1', { method: 'DELETE' })
    })
  })
})
