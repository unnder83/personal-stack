import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import AdminPostsPage from './pages/AdminPostsPage'
import BlogListPage from './pages/BlogListPage'
import LoginPage from './pages/LoginPage'
import PostDetailPage from './pages/PostDetailPage'
import PostFormPage from './pages/PostFormPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<BlogListPage />} />
          <Route path="/posts/:slug" element={<PostDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Navigate to="/admin/posts" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/posts"
            element={
              <ProtectedRoute>
                <AdminPostsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/posts/new"
            element={
              <ProtectedRoute>
                <PostFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/posts/:id/edit"
            element={
              <ProtectedRoute>
                <PostFormPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
