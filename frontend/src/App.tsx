import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { BackgroundLayer } from './components/ui/BackgroundLayer'
import AdminPostsPage from './pages/AdminPostsPage'
import BlogListPage from './pages/BlogListPage'
import DrivePage from './pages/DrivePage'
import HomeGate from './pages/HomeGate'
import LoginPage from './pages/LoginPage'
import PostDetailPage from './pages/PostDetailPage'
import PostFormPage from './pages/PostFormPage'
import { ThemePanel } from './theme/ThemePanel'
import { ThemeProvider } from './theme/ThemeProvider'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundLayer />
          <Routes>
            <Route path="/" element={<HomeGate />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/posts/:slug" element={<PostDetailPage />} />
            <Route
              path="/drive"
              element={
                <ProtectedRoute>
                  <DrivePage />
                </ProtectedRoute>
              }
            />
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
          <ThemePanel />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
