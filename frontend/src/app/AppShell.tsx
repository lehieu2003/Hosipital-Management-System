import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../lib/auth/session'

const navItems = [
  { to: '/admin', label: 'Admin', roles: ['admin'] },
  { to: '/reception/scheduling', label: 'Scheduling', roles: ['receptionist', 'admin'] },
  { to: '/doctor/queue', label: 'Doctor queue', roles: ['doctor', 'admin'] },
] as const

export function AppShell() {
  const { session, logout, authStatus } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">OPD console</p>
          <h1 className="sidebar__title">Hospital Management</h1>
          <p className="muted">Role-aware operational cockpit with fail-closed UI states.</p>
        </div>

        <nav className="nav">
          {navItems
            .filter((item) => session && item.roles.includes(session.role))
            .map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar__footer">
          <div>
            <p className="muted">Signed in as</p>
            <strong>{session?.username ?? 'anonymous'}</strong>
            <p className="muted">Role: {session?.role ?? 'none'}</p>
          </div>
          <button className="button button--ghost" onClick={() => void logout()} type="button">
            Sign out
          </button>
          {authStatus === 'refresh-failed' ? (
            <p className="status status--danger" data-testid="refresh-failed-banner">
              Session refresh failed. Sign in again.
            </p>
          ) : null}
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
