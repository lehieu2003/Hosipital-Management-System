import { Activity, CalendarClock, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth, type UserRole } from '@/features/auth';

const navItems: Array<{
  description: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles: UserRole[];
  to: string;
}> = [
  {
    description: 'Access and workforce controls',
    icon: ShieldCheck,
    label: 'Admin',
    roles: ['admin'],
    to: '/admin',
  },
  {
    description: 'Appointments and patient intake',
    icon: CalendarClock,
    label: 'Scheduling',
    roles: ['receptionist', 'admin'],
    to: '/reception/scheduling',
  },
  {
    description: 'Live consultation queue view',
    icon: Activity,
    label: 'Doctor queue',
    roles: ['doctor', 'admin'],
    to: '/doctor/queue',
  },
];

function navLinkClass(isActive: boolean) {
  return cn(
    'flex items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors',
    isActive
      ? 'border-primary/20 bg-primary/5 text-foreground shadow-sm'
      : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground',
  );
}

export function MainLayout() {
  const { session, logout, authStatus } = useAuth();

  return (
    <div className="min-h-screen bg-transparent lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-sidebar/80 backdrop-blur lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-5 px-4 py-4 lg:px-5 lg:py-5">
          <Card className="border-primary/10 bg-background/90 shadow-sm">
            <CardHeader className="gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <LayoutDashboard className="size-5" />
                </div>
                <div className="space-y-1">
                  <Badge variant="secondary">OPD console</Badge>
                  <CardTitle className="text-lg">Hospital Management</CardTitle>
                  <CardDescription>
                    Role-aware frontend shell with fail-closed authentication states.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <nav aria-label="Primary navigation" className="grid gap-2">
            {navItems
              .filter((item) => session && item.roles.includes(session.role))
              .map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} className={({ isActive }) => navLinkClass(isActive)} to={item.to}>
                    {({ isActive }) => (
                      <>
                        <div
                          className={cn(
                            'mt-0.5 rounded-md border p-2',
                            isActive
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border/70 bg-background text-muted-foreground',
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                        </div>
                      </>
                    )}
                  </NavLink>
                );
              })}
          </nav>

          <div className="mt-auto space-y-4">
            <Separator />
            <Card className="border-border/70 bg-slate-950 text-slate-50">
              <CardHeader className="gap-2">
                <Badge className="w-fit" variant="outline">Active session</Badge>
                <CardTitle className="text-base text-white">
                  {session?.username ?? 'anonymous'}
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Role: {session?.role ?? 'none'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-center" onClick={() => void logout()} variant="secondary">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
                {authStatus === 'refresh-failed' ? (
                  <p
                    className="rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                    data-testid="refresh-failed-banner"
                  >
                    Session refresh failed. Sign in again.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </aside>

      <main className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
