import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import AdminPage from './AdminPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminPage', () => {
  it('点击退出登录后回到登录页', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/auth/me') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 1, username: 'admin' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        if (url === '/api/auth/logout') {
          return Promise.resolve(new Response('{"status":"ok"}', { status: 200 }))
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<h1>登录页</h1>} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('当前用户：admin')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))

    await waitFor(() => {
      expect(screen.getByText('登录页')).toBeInTheDocument()
    })
  })
})
