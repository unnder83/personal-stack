import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
