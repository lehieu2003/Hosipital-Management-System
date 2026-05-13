import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { SchedulingPage } from '../features/appointments/SchedulingPage'
import { QueuePage } from '../features/queue/QueuePage'
import { useAuth } from '../lib/auth/session'

function HomeRedirect() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.role === 'doctor') {
    return <Navigate to="/doctor/queue" replace />
  }

  if (session.role === 'receptionist') {
    return <Navigate to="/reception/scheduling" replace />
  }

  return <Navigate to="/admin" replace />
}

function AdminPage() {
  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Admin</p>
        <h1>Administration shell</h1>
        <p className="muted">Department setup and doctor assignment are not wired yet in this repository snapshot.</p>
      </div>
    </section>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        element={<ProtectedRoute><AppShell /></ProtectedRoute>}
      >
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/reception/scheduling" element={<SchedulingPage />} />
        <Route path="/doctor/queue" element={<QueuePage />} />
      </Route>
    </Routes>
  )
}
