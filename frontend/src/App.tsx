import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DataManagement from './pages/DataManagement'
import RunMatching from './pages/RunMatching'
import Results from './pages/Results'
import Downloads from './pages/Downloads'
import History from './pages/History'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <AntApp>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/data" element={<PrivateRoute><DataManagement /></PrivateRoute>} />
          <Route path="/run" element={<PrivateRoute><RunMatching /></PrivateRoute>} />
          <Route path="/results" element={<PrivateRoute><Results /></PrivateRoute>} />
          <Route path="/downloads" element={<PrivateRoute><Downloads /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AntApp>
    </BrowserRouter>
  )
}
