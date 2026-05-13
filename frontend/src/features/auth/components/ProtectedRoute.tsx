import type { PropsWithChildren } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/use-auth';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const { session, authStatus } = useAuth();

  if (authStatus === 'booting' || authStatus === 'refreshing') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[var(--shadow-panel)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
            Authorizing
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            Validating session
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Checking access token state before opening operational screens.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-brand-500 to-mint-500" />
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return children ?? <Outlet />;
}
