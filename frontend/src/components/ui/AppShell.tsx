import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import { Button } from './Button'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface backdrop-blur-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight text-fg">
            personal-stack
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted md:flex">
            <Link to="/blog" className="hover:text-fg">
              博客
            </Link>
            <Link to="/drive" className="hover:text-fg">
              网盘
            </Link>
            {user && (
              <Link to="/admin/posts" className="hover:text-fg">
                管理
              </Link>
            )}
            {user ? (
              <Button onClick={handleLogout}>退出（{user.username}）</Button>
            ) : (
              <Link to="/login" className="hover:text-fg">
                登录
              </Link>
            )}
          </nav>

          <button
            type="button"
            aria-label="菜单"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-card border border-border px-3 py-1 text-sm md:hidden"
          >
            菜单
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm md:hidden">
            <Link to="/blog" onClick={() => setMenuOpen(false)}>
              博客
            </Link>
            <Link to="/drive" onClick={() => setMenuOpen(false)}>
              网盘
            </Link>
            {user && (
              <Link to="/admin/posts" onClick={() => setMenuOpen(false)}>
                管理
              </Link>
            )}
            {user ? (
              <button type="button" onClick={handleLogout} className="text-left">
                退出（{user.username}）
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                登录
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
