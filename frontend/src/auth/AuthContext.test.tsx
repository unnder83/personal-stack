import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LoginPage from '../pages/LoginPage'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthProvider', () => {
  it('登录成功后，迟到的 me 401 不会把用户踢回登录页', async () => {
    let resolveMe: ((response: Response) => void) | undefined
    const mePromise = new Promise<Response>((resolve) => {
      resolveMe = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/auth/me') {
          return mePromise
        }
        if (url === '/api/auth/login' && init?.method === 'POST') {
          return Promise.resolve(
            Response.json({ id: 1, username: 'admin' }),
          )
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <h1>管理内容</h1>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    resolveMe?.(new Response('', { status: 401 }))

    expect(await screen.findByText('管理内容')).toBeInTheDocument()
  })
})
