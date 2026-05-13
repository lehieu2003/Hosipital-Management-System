import { NavLink, Outlet } from 'react-router-dom';

import { useAuth, type UserRole } from '@/features/auth';

const navItems: Array<{ description: string; label: string; roles: UserRole[]; to: string }> = [
  {
    description: 'Access and workforce controls',
    label: 'Admin',
    roles: ['admin'],
    to: '/admin',
  },
  {
    description: 'Appointments and patient intake',
    label: 'Scheduling',
    roles: ['receptionist', 'admin'],
    to: '/reception/scheduling',
  },
  {
    description: 'Live consultation queue view',
    label: 'Doctor queue',
    roles: ['doctor', 'admin'],
    to: '/doctor/queue',
  },
];

function navLinkClass(isActive: boolean) {
  return [
    'group rounded-[1.4rem] border px-4 py-3 transition duration-200',
    isActive
      ? 'border-brand-200 bg-gradient-to-r from-brand-50 to-mint-50 text-slate-900 shadow-sm'
      : 'border-transparent bg-white/40 text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900',
  ].join(' ');
}

export function MainLayout() {
  const { session, logout, authStatus } = useAuth();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-white/70 bg-white/80 px-4 py-5 backdrop-blur lg:min-h-screen lg:border-r lg:border-b-0 lg:px-6 lg:py-6">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 lg:max-w-none">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-mint-500 text-lg font-extrabold text-white shadow-lg shadow-brand-200/60">
                HM
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
                  OPD console
                </p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                  Hospital Management
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Clinical light-theme shell with role-aware navigation and fail-closed auth cues.
                </p>
              </div>
            </div>
          </div>

          <nav className="grid gap-2" aria-label="Primary navigation">
            {navItems
              .filter((item) => session && item.roles.includes(session.role))
              .map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) => navLinkClass(isActive)}
                  to={item.to}
                >
                  <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 transition group-hover:text-slate-600">
                    {item.description}
                  </span>
                </NavLink>
              ))}
          </nav>

          <div className="mt-auto rounded-[2rem] border border-slate-200 bg-slate-950 px-5 py-5 text-white shadow-[var(--shadow-soft)]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">
              Active session
            </p>
            <div className="mt-3 space-y-1">
              <p className="text-lg font-bold tracking-tight">
                {session?.username ?? 'anonymous'}
              </p>
              <p className="text-sm text-slate-300">Role: {session?.role ?? 'none'}</p>
            </div>

            <button
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => void logout()}
              type="button"
            >
              Sign out
            </button>

            {authStatus === 'refresh-failed' ? (
              <p
                className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700"
                data-testid="refresh-failed-banner"
              >
                Session refresh failed. Sign in again.
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
