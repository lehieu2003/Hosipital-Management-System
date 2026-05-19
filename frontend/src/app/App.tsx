import { Navigate, Route, Routes } from 'react-router-dom';

import { MainLayout } from '@/components/layout/MainLayout';
import { SchedulingPage } from '@/features/appointments/SchedulingPage';
import { LoginPage, ProtectedRoute, resolveHomePath, useAuth } from '@/features/auth';
import { InpatientsPage } from '@/features/ipd/InpatientsPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { AdminOverviewPage } from '@/features/opd/AdminOverviewPage';
import { QueuePage } from '@/features/queue/QueuePage';

function AppRedirect() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={resolveHomePath(session.role)} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<AppRedirect />} path="/app" />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
        path="/app"
      >
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOverviewPage />
            </ProtectedRoute>
          }
          path="admin"
        />
        <Route
          element={
            <ProtectedRoute allowedRoles={['receptionist', 'admin']}>
              <SchedulingPage />
            </ProtectedRoute>
          }
          path="reception/scheduling"
        />
        <Route
          element={
            <ProtectedRoute allowedRoles={['receptionist', 'admin']}>
              <InpatientsPage />
            </ProtectedRoute>
          }
          path="reception/inpatients"
        />
        <Route
          element={
            <ProtectedRoute allowedRoles={['doctor', 'admin']}>
              <QueuePage />
            </ProtectedRoute>
          }
          path="doctor/queue"
        />
      </Route>
    </Routes>
  );
}
