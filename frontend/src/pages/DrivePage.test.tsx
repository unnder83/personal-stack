import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import DrivePage from './DrivePage'

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

const EMPTY_CONTENTS = { folder: null, breadcrumb: [], folders: [], files: [] }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderDrive() {
  return render(
    <MemoryRouter initialEntries={['/drive']}>
      <AuthProvider>
        <Routes>
          <Route path="/drive" element={<DrivePage />} />
          <Route path="/login" element={<h1>登录页</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DrivePage', () => {
  it('展示目录内容与用量', async () => {
    stubFetch([
      ['GET', '/api/auth/me', 200, { id: 1, username: 'admin' }],
      ['GET', '/api/folders/tree', 200, []],
      [
        'GET',
        '/api/folders',
        200,
        {
          folder: null,
          breadcrumb: [],
          folders: [{ id: 1, name: '文档', parent_id: null, created_at: '', updated_at: '' }],
          files: [
            {
              id: 2,
              name: 'a.txt',
              folder_id: null,
              size: 5,
              mime_type: 'text/plain',
              sha256: 'x',
              created_at: '',
            },
          ],
        },
      ],
      ['GET', '/api/storage/usage', 200, { used_bytes: 5, file_count: 1 }],
    ])

    renderDrive()

    expect(await screen.findByText('文档')).toBeInTheDocument()
    expect(screen.getByText('a.txt')).toBeInTheDocument()
    expect(screen.getByText('已用 5 B / 1 个文件')).toBeInTheDocument()
  })

  it('新建文件夹会提交 POST', async () => {
    stubFetch([
      ['GET', '/api/auth/me', 200, { id: 1, username: 'admin' }],
      ['GET', '/api/folders/tree', 200, []],
      ['GET', '/api/folders', 200, EMPTY_CONTENTS],
      ['GET', '/api/storage/usage', 200, { used_bytes: 0, file_count: 0 }],
      ['POST', '/api/folders', 200, { id: 9, name: '新目录', parent_id: null }],
    ])
    vi.spyOn(window, 'prompt').mockReturnValue('新目录')

    renderDrive()
    await screen.findByText('空目录')

    fireEvent.click(screen.getByRole('button', { name: '新建文件夹' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/folders',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('上传文件使用 FormData', async () => {
    stubFetch([
      ['GET', '/api/auth/me', 200, { id: 1, username: 'admin' }],
      ['GET', '/api/folders/tree', 200, []],
      ['GET', '/api/folders', 200, EMPTY_CONTENTS],
      ['GET', '/api/storage/usage', 200, { used_bytes: 0, file_count: 0 }],
      [
        'POST',
        '/api/files/upload',
        200,
        {
          id: 3,
          name: 'upload.txt',
          folder_id: null,
          size: 1,
          mime_type: 'text/plain',
          sha256: 'y',
          created_at: '',
        },
      ],
    ])

    renderDrive()
    await screen.findByText('空目录')

    const file = new File(['x'], 'upload.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('上传文件'), { target: { files: [file] } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/files/upload'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('删除文件会调用 DELETE', async () => {
    stubFetch([
      ['GET', '/api/auth/me', 200, { id: 1, username: 'admin' }],
      ['GET', '/api/folders/tree', 200, []],
      [
        'GET',
        '/api/folders',
        200,
        {
          folder: null,
          breadcrumb: [],
          folders: [],
          files: [
            {
              id: 2,
              name: 'a.txt',
              folder_id: null,
              size: 5,
              mime_type: 'text/plain',
              sha256: 'x',
              created_at: '',
            },
          ],
        },
      ],
      ['GET', '/api/storage/usage', 200, { used_bytes: 5, file_count: 1 }],
      ['DELETE', '/api/files/2', 200, { status: 'ok' }],
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDrive()
    fireEvent.click(await screen.findByRole('button', { name: '删除 a.txt' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/files/2', { method: 'DELETE' })
    })
  })
})
