import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProtectedRoute', () => {
  it('未登录时重定向到登录页', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    )

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<h1>登录页</h1>} />
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

    expect(await screen.findByText('登录页')).toBeInTheDocument()
  })
})
