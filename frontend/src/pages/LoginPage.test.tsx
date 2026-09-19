import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import LoginPage from './LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<h1>管理后台</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function mockFetch(loginStatus: number, loginBody: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') {
        return Promise.resolve(new Response('', { status: 401 }))
      }
      if (url === '/api/auth/login' && init?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify(loginBody), {
            status: loginStatus,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage', () => {
  it('登录成功后跳转到管理页', async () => {
    mockFetch(200, { id: 1, username: 'admin' })

    renderLogin()
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByText('管理后台')).toBeInTheDocument()
  })

  it('凭据错误时显示后端错误消息', async () => {
    mockFetch(401, { code: 'invalid_credentials', message: '用户名或密码错误' })

    renderLogin()
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('用户名或密码错误')
  })
})
