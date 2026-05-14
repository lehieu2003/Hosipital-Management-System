import {
  Activity,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleGauge,
  Download,
  GalleryVerticalEnd,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeft,
  Palette,
  Search,
  ShieldCheck,
  Sparkle,
  Stethoscope,
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
        to: '/admin',
      },
      {
        icon: CalendarDays,
        label: 'Scheduling',
        roles: ['receptionist', 'admin'],
        to: '/reception/scheduling',
      },
      {
        icon: Activity,
        label: 'Doctor Queue',
        roles: ['doctor', 'admin'],
        to: '/doctor/queue',
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
        to: '/admin',
      },
      {
        icon: CircleGauge,
        label: 'Patient Flow',
        roles: ['admin', 'doctor', 'receptionist'],
        to: '/doctor/queue',
      },
    ],
  },
];

const titles: Record<string, string> = {
  '/admin': 'Hospital Dashboard',
  '/doctor/queue': 'Doctor Queue',
  '/reception/scheduling': 'Scheduling Dashboard',
};

function navLinkClass(isActive: boolean) {
  return cn(
    'group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-[background-color,color,transform]',
    isActive
      ? 'bg-cyan-100 text-cyan-950 shadow-[inset_0_0_0_1px_rgb(8_145_178/0.12)]'
      : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-950',
  );
}

export function MainLayout() {
  const { session, logout, authStatus } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pageTitle = titles[location.pathname] ?? 'Hospital Dashboard';

  return (
    <div
      className={cn(
        'medical-shell min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-out',
        isSidebarOpen ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : 'lg:grid-cols-[88px_minmax(0,1fr)]',
      )}
    >
      <aside
        id="app-sidebar"
        className="border-b border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-r lg:border-b-0"
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              'flex h-[70px] items-center border-b border-sidebar-border transition-[padding] duration-300',
              isSidebarOpen ? 'justify-between px-7' : 'justify-center px-3',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="brand-mark flex size-9 items-center justify-center rounded-xl">
                <GalleryVerticalEnd className="size-5" />
              </div>
              <span
                className={cn(
                  'text-base font-bold tracking-tight text-slate-950 transition-opacity duration-200',
                  !isSidebarOpen && 'hidden',
                )}
              >
                MediCore HMS
              </span>
            </div>
            <ChevronDown className={cn('size-4 text-muted-foreground', !isSidebarOpen && 'hidden')} />
          </div>

          <div className={cn('min-h-0 flex-1 overflow-y-auto py-6', isSidebarOpen ? 'px-5' : 'px-3')}>
            <nav aria-label="Primary navigation" className={cn(isSidebarOpen ? 'space-y-7' : 'space-y-4')}>
              {navGroups.map((group) => {
                const visibleItems = group.items.filter(
                  (item) => session && item.roles.includes(session.role),
                );

                if (visibleItems.length === 0) {
                  return null;
                }

                return (
                  <div key={group.label} className="space-y-2">
                    <p
                      className={cn(
                        'px-1 text-sm font-medium text-cyan-700/60',
                        !isSidebarOpen && 'sr-only',
                      )}
                    >
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <NavLink
                            key={`${group.label}-${item.label}`}
                            aria-label={!isSidebarOpen ? item.label : undefined}
                            className={({ isActive }) =>
                              cn(
                                navLinkClass(isActive),
                                !isSidebarOpen && 'justify-center gap-0 px-0',
                              )
                            }
                            title={!isSidebarOpen ? item.label : undefined}
                            to={item.to}
                          >
                            <Icon className="size-4 text-cyan-700/70 transition-colors group-hover:text-cyan-950" />
                            <span className={cn(!isSidebarOpen && 'sr-only')}>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          <div className={cn('space-y-5 p-5', !isSidebarOpen && 'p-3')}>
            <div
              className={cn(
                'rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm',
                !isSidebarOpen && 'hidden',
              )}
            >
              <div className="space-y-2">
                <h2 className="text-base font-bold">Unlock Everything</h2>
                <p className="text-pretty text-sm leading-6 text-muted-foreground">
                  Premium templates, audit views, and operational dashboards for every hospital
                  workflow.
                </p>
              </div>
              <Button className="brand-button mt-4 h-11 w-full rounded-lg">
                <span className="size-2 rounded-full bg-emerald-300" />
                Get Full Access
              </Button>
            </div>

            <div className={cn('flex items-center gap-3 px-1', !isSidebarOpen && 'justify-center px-0')}>
              <div className="brand-mark grid size-10 place-items-center rounded-full text-sm font-semibold">
                {(session?.username ?? 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className={cn('min-w-0 flex-1', !isSidebarOpen && 'hidden')}>
                <p className="truncate text-sm font-semibold text-slate-950">
                  {session?.username ?? 'anonymous'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{session?.role ?? 'none'}</p>
              </div>
              <Button
                aria-label="Sign out"
                className={cn('size-9 rounded-lg', !isSidebarOpen && 'hidden')}
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
                  'rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900',
                  !isSidebarOpen && 'hidden',
                )}
                data-testid="refresh-failed-banner"
              >
                Session refresh failed. Sign in again.
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-[70px] items-center gap-4 px-5 lg:px-8">
            <Button
              aria-controls="app-sidebar"
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="size-10 rounded-lg"
              onClick={() => setIsSidebarOpen((current) => !current)}
              size="icon"
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              variant="ghost"
            >
              <PanelLeft className="size-4" />
            </Button>
            <Separator className="hidden h-8 sm:block" orientation="vertical" />
            <div className="relative hidden w-full max-w-[480px] sm:block">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search"
                className="h-11 rounded-lg bg-white pr-14 pl-11 shadow-sm focus-visible:border-cyan-500 focus-visible:ring-cyan-500/20"
                placeholder="Search..."
              />
              <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
                ⌘ K
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Button className="hidden text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800 md:inline-flex" variant="ghost">
                Care Pro
              </Button>
              <Button aria-label="Notifications" className="relative size-10 rounded-lg" size="icon" variant="ghost">
                <Bell className="size-4" />
                <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500" />
              </Button>
              <Button aria-label="Theme" className="size-10 rounded-lg" size="icon" variant="ghost">
                <Moon className="size-4" />
              </Button>
              <Button aria-label="Palette" className="size-10 rounded-lg" size="icon" variant="ghost">
                <Palette className="size-4" />
              </Button>
              <Separator className="hidden h-8 md:block" orientation="vertical" />
              <div className="brand-mark grid size-10 place-items-center rounded-full text-sm font-semibold ring-1 ring-cyan-700/10">
                {(session?.username ?? 'U').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-5 lg:px-8">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkle className="size-4" />
                Live workspace
              </div>
              <h1 className="text-balance text-3xl font-bold tracking-[-0.04em] text-slate-950">
                {pageTitle}
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="h-11 justify-start rounded-lg bg-white shadow-sm" variant="outline">
                <CalendarRange className="size-4" />
                17 Apr 2026 - 14 May 2026
              </Button>
              <Button className="brand-button h-11 rounded-lg px-5">
                <Download className="size-4" />
                Download
              </Button>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
