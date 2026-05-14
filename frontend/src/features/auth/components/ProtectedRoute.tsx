import type { PropsWithChildren } from 'react';
import { Shield } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '../hooks/use-auth';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const { session, authStatus } = useAuth();

  if (authStatus === 'booting' || authStatus === 'refreshing') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6" data-testid="auth-loading-state">
        <Card className="w-full max-w-xl border-primary/10 bg-background/90 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div className="space-y-2">
              <CardTitle>Validating session</CardTitle>
              <p className="text-muted-foreground text-sm leading-6">
                Checking token state before any operational screen opens.
              </p>
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

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return children ?? <Outlet />;
}
