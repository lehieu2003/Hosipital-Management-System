import { Navigate, Route, Routes } from 'react-router-dom';

import { MainLayout } from '@/components/layout/MainLayout';
import { SchedulingPage } from '@/features/appointments/SchedulingPage';
import { LoginPage, ProtectedRoute, resolveHomePath, useAuth } from '@/features/auth';
import { QueuePage } from '@/features/queue/QueuePage';

function HomeRedirect() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={resolveHomePath(session.role)} />;
}

function AdminPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[var(--shadow-panel)] backdrop-blur sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Admin</p>
        <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Administration shell
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Department setup, user administration, and doctor assignment controls are the next
          admin-facing layer. This shell keeps the protected route contract and the visual
          system stable while those workflows land.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600">
            Current boundary
          </p>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Role-aware shell only</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Navigation, auth gating, and sign-out state are live now. Operational forms stay
            disabled until the backend contract exists.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600">
            Safety rule
          </p>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Fail closed on uncertainty</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Protected admin screens should refuse to imply access or success when session state
            or downstream configuration is incomplete.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600">
            Next integration
          </p>
          <h2 className="mt-3 text-xl font-bold text-slate-900">User and roster setup</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Once the backend exposes staffing endpoints, this space can absorb configuration
            forms without needing another visual rewrite.
          </p>
        </article>
      </div>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<HomeRedirect />} path="/" />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route element={<AdminPage />} path="/admin" />
        <Route element={<SchedulingPage />} path="/reception/scheduling" />
        <Route element={<QueuePage />} path="/doctor/queue" />
      </Route>
    </Routes>
  );
}
