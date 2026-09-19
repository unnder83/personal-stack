import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export function AdminHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <header>
      <p>当前用户：{user?.username}</p>
      <Link to="/">返回博客</Link>
      <button onClick={handleLogout}>退出登录</button>
    </header>
  )
}
