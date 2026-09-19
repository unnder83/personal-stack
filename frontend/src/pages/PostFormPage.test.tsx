import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import PostFormPage from './PostFormPage'

vi.mock('../components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="正文" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PostFormPage', () => {
  it('新建文章提交 POST 并返回列表', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/auth/me') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 1, username: 'admin' }), { status: 200 }),
          )
        }
        if (url === '/api/admin/posts' && init?.method === 'POST') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 9, title: '新文章', slug: 'new-post' }), {
              status: 200,
            }),
          )
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    render(
      <MemoryRouter initialEntries={['/admin/posts/new']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/posts/new" element={<PostFormPage />} />
            <Route path="/admin/posts" element={<h1>文章列表</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('标题'), { target: { value: '新文章' } })
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: '正文内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('文章列表')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/posts',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
