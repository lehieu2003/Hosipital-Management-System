import {
  Activity,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleGauge,
  GalleryVerticalEnd,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Search,
  ShieldCheck,
  Sparkle,
  Stethoscope,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth, type UserRole } from '@/features/auth';

const navGroups: Array<{
  items: Array<{
    icon: typeof LayoutDashboard;
    label: string;
    roles: UserRole[];
    to: string;
  }>;
  label: string;
}> = [
  {
    label: 'Dashboards',
    items: [
      {
        icon: ShieldCheck,
        label: 'Admin Dashboard',
        roles: ['admin'],
        to: '/app/admin',
      },
      {
        icon: CalendarDays,
        label: 'Scheduling',
        roles: ['receptionist', 'admin'],
        to: '/app/reception/scheduling',
      },
      {
        icon: Activity,
        label: 'Doctor Queue',
        roles: ['doctor', 'admin'],
        to: '/app/doctor/queue',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        icon: Stethoscope,
        label: 'Departments',
        roles: ['admin'],
        to: '/app/admin',
      },
      {
        icon: CircleGauge,
        label: 'Patient Flow',
        roles: ['admin', 'doctor', 'receptionist'],
        to: '/app/doctor/queue',
      },
    ],
  },
];

const titles: Record<string, string> = {
  '/app/admin': 'Hospital Dashboard',
  '/app/doctor/queue': 'Doctor Queue',
  '/app/reception/scheduling': 'Scheduling Dashboard',
};

function navLinkClass(isActive: boolean) {
  return cn(
    'group flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium transition-[background-color,color,box-shadow]',
    isActive
      ? 'bg-white text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_0_0_1px_rgba(8,145,178,0.12)]'
      : 'text-slate-500 hover:bg-white/70 hover:text-slate-900',
  );
}

function roleLabel(role?: UserRole | 'anonymous') {
  if (role === 'admin') {
    return 'Admin';
  }

  if (role === 'receptionist') {
    return 'Reception';
  }

  if (role === 'doctor') {
    return 'Doctor';
  }

  return 'Anonymous';
}

export function MainLayout() {
  const { session, logout, authStatus, sessionNotice } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pageTitle = titles[location.pathname] ?? 'Hospital Dashboard';

  function closeSidebarOnMobile() {
    setIsSidebarOpen(false);
  }

  return (
    <div
      className={cn(
        'medical-shell min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-out',
        isSidebarOpen ? 'lg:grid-cols-[292px_minmax(0,1fr)]' : 'lg:grid-cols-[92px_minmax(0,1fr)]',
      )}
      data-auth-status={authStatus}
      data-current-path={location.pathname}
      data-role={session?.role ?? 'anonymous'}
      data-session-notice={sessionNotice ?? 'none'}
      data-testid="app-shell"
    >
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/24 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden',
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeSidebarOnMobile}
      />

      <aside
        id="app-sidebar"
        className={cn(
          'sidebar-surface fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] border-r border-white/60 backdrop-blur-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:max-w-none lg:overflow-hidden lg:border-r',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              'flex h-[74px] items-center border-b border-white/60 transition-[padding] duration-300',
              isSidebarOpen ? 'justify-between px-6' : 'justify-center px-3 lg:justify-center',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="brand-mark flex size-10 items-center justify-center rounded-2xl shadow-sm">
                <GalleryVerticalEnd className="size-5" />
              </div>
              <div className={cn('space-y-0.5', !isSidebarOpen && 'hidden lg:hidden')}>
                <span className="block text-sm font-semibold tracking-tight text-slate-950">
                  MediCore HMS
                </span>
                <span className="block text-xs text-slate-500">Clinical operations</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('size-4 text-muted-foreground', !isSidebarOpen && 'hidden lg:hidden')} />
              <Button
                aria-label="Close sidebar"
                className="size-9 rounded-xl text-slate-500 hover:text-slate-900 lg:hidden"
                onClick={closeSidebarOnMobile}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className={cn('min-h-0 flex-1 overflow-y-auto py-6', isSidebarOpen ? 'px-4' : 'px-3')}>
            <nav
              aria-label="Primary navigation"
              className={cn(isSidebarOpen ? 'space-y-6' : 'space-y-4 lg:space-y-6')}
              data-testid="primary-navigation"
            >
              {navGroups.map((group) => {
                const visibleItems = group.items.filter(
                  (item) => session && item.roles.includes(session.role),
                );

                if (visibleItems.length === 0) {
                  return null;
                }

                return (
                  <div key={group.label} className="space-y-2.5">
                    <p
                      className={cn(
                        'px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400',
                        !isSidebarOpen && 'sr-only lg:not-sr-only',
                      )}
                    >
                      {group.label}
                    </p>
                    <div className="space-y-1.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <NavLink
                            key={`${group.label}-${item.label}`}
                            aria-label={!isSidebarOpen ? item.label : undefined}
                            className={({ isActive }) =>
                              cn(
                                navLinkClass(isActive),
                                !isSidebarOpen && 'justify-center gap-0 px-0 lg:justify-center lg:px-0',
                              )
                            }
                            onClick={closeSidebarOnMobile}
                            title={!isSidebarOpen ? item.label : undefined}
                            to={item.to}
                          >
                            <Icon className="size-4 text-cyan-700/80 transition-colors group-hover:text-cyan-900" />
                            <span className={cn(!isSidebarOpen && 'sr-only lg:sr-only')}>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          <div className={cn('border-t border-white/60 p-4', !isSidebarOpen && 'p-3 lg:p-4')}>
            <div className={cn('rounded-3xl bg-white/72 p-4 shadow-sm ring-1 ring-slate-200/70', !isSidebarOpen && 'p-2.5 lg:p-4')}>
              <div className={cn('flex items-center gap-3', !isSidebarOpen && 'justify-center lg:justify-center')}>
                <div className="brand-mark grid size-10 place-items-center rounded-2xl text-sm font-semibold shadow-sm">
                  {(session?.username ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className={cn('min-w-0 flex-1', !isSidebarOpen && 'hidden lg:hidden')}>
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {session?.username ?? 'anonymous'}
                  </p>
                  <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-400">
                    {roleLabel(session?.role ?? 'anonymous')}
                  </p>
                </div>
                <Button
                  aria-label="Sign out"
                  className={cn('size-9 rounded-xl text-slate-500 hover:text-slate-900', !isSidebarOpen && 'hidden lg:hidden')}
                  onClick={() => void logout()}
                  size="icon"
                  variant="ghost"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>

              {authStatus === 'refresh-failed' ? (
                <p
                  className={cn(
                    'mt-4 rounded-2xl border border-amber-300/50 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900',
                    !isSidebarOpen && 'hidden lg:hidden',
                  )}
                  data-testid="refresh-failed-banner"
                >
                  Session refresh failed. Sign in again.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="main-surface min-w-0">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/78 backdrop-blur-xl">
          <div className="flex h-[74px] items-center gap-4 px-4 sm:px-5 lg:px-8">
            <Button
              aria-controls="app-sidebar"
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="size-10 rounded-xl text-slate-500 hover:text-slate-900"
              onClick={() => setIsSidebarOpen((current) => !current)}
              size="icon"
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              variant="ghost"
            >
              <PanelLeft className="size-4" />
            </Button>
            <Separator className="hidden h-8 sm:block" orientation="vertical" />
            <div className="relative hidden w-full max-w-[420px] sm:block">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search"
                className="h-11 rounded-2xl border-white/70 bg-white/90 pr-14 pl-11 shadow-sm focus-visible:border-cyan-500 focus-visible:ring-cyan-500/20"
                placeholder="Search patients, queues, or appointments"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                ⌘ K
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-cyan-800 ring-1 ring-cyan-100 md:block">
                Care Pro
              </div>
              <Button aria-label="Notifications" className="relative size-10 rounded-xl text-slate-500 hover:text-slate-900" size="icon" variant="ghost">
                <Bell className="size-4" />
                <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-rose-500" />
              </Button>
              <div className="grid size-10 place-items-center rounded-2xl bg-white/88 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/80 shadow-sm">
                {(session?.username ?? 'U').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Sparkle className="size-4" />
                Live workspace
              </div>
              <div className="space-y-2">
                <h1 className="text-balance text-3xl font-bold tracking-[-0.04em] text-slate-950">
                  {pageTitle}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Role-aware operational surfaces with fail-closed behavior and stable diagnostics.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="h-11 justify-start rounded-2xl border-white/80 bg-white/90 text-slate-700 shadow-sm" variant="outline">
                <CalendarRange className="size-4" />
                17 Apr 2026 - 14 May 2026
              </Button>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
