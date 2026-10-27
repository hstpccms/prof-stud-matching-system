import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DataManagement from './pages/DataManagement'
import RunMatching from './pages/RunMatching'
import Results from './pages/Results'
import Downloads from './pages/Downloads'
import History from './pages/History'
import AdminUsers from './pages/AdminUsers'
import StudentPortal from './pages/StudentPortal'
import ProfessorPortal from './pages/ProfessorPortal'

import { ProgramProvider } from './ProgramContext'

function homeFor(role: string | null) {
  if (role === 'student') return '/student'
  if (role === 'professor') return '/professor'
  if (role === 'admin') return '/'
  return '/login'
}

/** Guard: ต้องล็อกอิน + (ถ้ากำหนด roles) ต้องมี role ที่อนุญาต */
function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')
  if (!token || !role) {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    return <Navigate to="/login" replace />
  }
  if (roles && !roles.includes(role)) {
    // role ไม่ตรง → เด้งกลับหน้าแรกของ role ตัวเอง
    return <Navigate to={homeFor(role)} replace />
  }
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ProgramProvider>
          <AntApp>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Admin */}
              <Route path="/" element={<PrivateRoute roles={['admin']}><Dashboard /></PrivateRoute>} />
              <Route path="/data" element={<PrivateRoute roles={['admin']}><DataManagement /></PrivateRoute>} />
              <Route path="/run" element={<PrivateRoute roles={['admin']}><RunMatching /></PrivateRoute>} />
              <Route path="/results" element={<PrivateRoute roles={['admin']}><Results /></PrivateRoute>} />
              <Route path="/downloads" element={<PrivateRoute roles={['admin']}><Downloads /></PrivateRoute>} />
              <Route path="/history" element={<PrivateRoute roles={['admin']}><History /></PrivateRoute>} />
              <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AdminUsers /></PrivateRoute>} />

              {/* Student / Professor portals */}
              <Route path="/student" element={<PrivateRoute roles={['student']}><StudentPortal /></PrivateRoute>} />
              <Route path="/professor" element={<PrivateRoute roles={['professor']}><ProfessorPortal /></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AntApp>
        </ProgramProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
