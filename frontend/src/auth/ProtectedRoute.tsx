import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>加载中...</p>
  }
  if (user === null) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
