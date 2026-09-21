import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    }
  }

  return (
    <AppShell>
      <Surface className="mx-auto mt-10 w-full max-w-sm p-6">
        <h1 className="mb-4 text-xl font-semibold">登录</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>
          {error !== '' && (
            <p role="alert" className="text-sm text-accent-text">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full">
            登录
          </Button>
        </form>
      </Surface>
    </AppShell>
  )
}
