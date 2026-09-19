import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <main>
      <h1>管理后台</h1>
      <p>当前用户：{user?.username}</p>
      <button onClick={handleLogout}>退出登录</button>
    </main>
  )
}
