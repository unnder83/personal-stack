import { useAuth } from '../auth/AuthContext'
import BlogListPage from './BlogListPage'
import ConsolePage from './ConsolePage'

export default function HomeGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="text-muted">加载中...</p>
  }
  return user ? <ConsolePage /> : <BlogListPage />
}
