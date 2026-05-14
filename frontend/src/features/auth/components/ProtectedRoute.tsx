import type { PropsWithChildren } from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '../hooks/use-auth';
import type { UserRole } from '@/lib/auth/session';

type ProtectedRouteProps = PropsWithChildren<{
  allowedRoles?: UserRole[];
}>;

function buildLoginReason(authStatus: ReturnType<typeof useAuth>['authStatus']) {
  if (authStatus === 'refresh-failed') {
    return 'refresh-failed';
  }

  return 'signed-out';
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { session, authStatus, sessionNotice } = useAuth();

  if (authStatus === 'booting' || authStatus === 'refreshing') {
    const title = sessionNotice === 'expired' ? 'Recovering expired session' : 'Validating session';
    const description =
      sessionNotice === 'expired'
        ? 'Your token expired. Attempting one safe refresh before any operational screen opens.'
        : 'Checking token state before any operational screen opens.';

    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6"
        data-auth-status={authStatus}
        data-testid="auth-loading-state"
      >
        <Card className="w-full max-w-xl border-primary/10 bg-background/90 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div className="space-y-2">
              <CardTitle>{title}</CardTitle>
              <p className="text-muted-foreground text-sm leading-6">{description}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStatus === 'authenticating') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6" data-testid="authenticating-state">
        <Card className="w-full max-w-xl border-primary/10 bg-background/90 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div className="space-y-2">
              <CardTitle>Signing in</CardTitle>
              <p className="text-muted-foreground text-sm leading-6">
                Waiting for the authentication boundary to confirm access.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        replace
        state={{ from: location, reason: buildLoginReason(authStatus) }}
        to="/login"
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-6 sm:px-6" data-testid="route-forbidden-state">
        <Card className="w-full max-w-2xl border-amber-200 bg-amber-50/60 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
              <ShieldAlert className="size-5" />
            </div>
            <div className="space-y-2">
              <CardTitle>Role access blocked</CardTitle>
              <p className="text-sm leading-6 text-amber-950/80">
                This route is fail-closed for your current role. Use the allowed workspace instead of
                inferring access from navigation state.
              </p>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-amber-950/80">
            Required roles: {allowedRoles.join(', ')}. Current role: {session.role}.
          </CardContent>
        </Card>
      </div>
    );
  }

  return children ?? <Outlet />;
}
