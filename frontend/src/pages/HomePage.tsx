import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const [status, setStatus] = useState('检测中...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status === 'ok' ? 'API 正常' : 'API 异常'))
      .catch(() => setStatus('API 不可达'))
  }, [])

  return (
    <main>
      <h1>personal-stack</h1>
      <p>后端状态：{status}</p>
      <Link to="/admin">进入管理后台</Link>
    </main>
  )
}
