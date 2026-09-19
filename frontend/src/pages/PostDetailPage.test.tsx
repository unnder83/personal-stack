import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PostDetailPage from './PostDetailPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/posts/first']}>
      <Routes>
        <Route path="/posts/:slug" element={<PostDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PostDetailPage', () => {
  it('渲染文章正文 Markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 1,
            title: '第一篇文章',
            slug: 'first',
            summary: null,
            published_at: '2026-09-19T12:00:00',
            tags: [],
            content_md: '## 正文标题',
            status: 'published',
            created_at: '2026-09-19T12:00:00',
            updated_at: '2026-09-19T12:00:00',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderDetail()

    expect(await screen.findByRole('heading', { name: '第一篇文章' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '正文标题' })).toBeInTheDocument()
  })

  it('文章不存在时显示提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"code":"not_found","message":"文章不存在"}', {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    renderDetail()

    expect(await screen.findByText('文章不存在')).toBeInTheDocument()
  })

  it('含特殊字符的标签链接正确编码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 1,
            title: '第一篇文章',
            slug: 'first',
            summary: null,
            published_at: '2026-09-19T12:00:00',
            tags: [{ id: 1, name: 'C#', slug: 'c#' }],
            content_md: '正文',
            status: 'published',
            created_at: '2026-09-19T12:00:00',
            updated_at: '2026-09-19T12:00:00',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderDetail()

    const link = await screen.findByRole('link', { name: 'C#' })
    expect(link).toHaveAttribute('href', '/?tag=c%23')
  })
})
