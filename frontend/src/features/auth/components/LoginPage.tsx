import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  GalleryVerticalEnd,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ApiError } from '@/lib/api/client';

import { resolveHomePath } from '../index';
import { useAuth } from '../hooks/use-auth';

type LocationState = {
  from?: {
    pathname: string;
  };
  reason?: 'refresh-failed' | 'signed-out' | 'expired';
};

const roleCards = [
  {
    copy: 'Staffing boundaries, department controls, and admin-only settings.',
    icon: ShieldCheck,
    label: 'Admin',
    metric: '98.2%',
  },
  {
    copy: 'Patient intake, appointment booking, and slot availability.',
    icon: CalendarClock,
    label: 'Reception',
    metric: '312',
  },
  {
    copy: 'Live queue polling, refresh recovery, and consultations.',
    icon: Stethoscope,
    label: 'Doctor',
    metric: '42',
  },
];

function renderSessionBanner(reason: LocationState['reason'] | null, authStatus: string) {
  if (authStatus === 'authenticating') {
    return (
      <Alert className="border-cyan-200 bg-cyan-50 text-cyan-950" data-testid="authenticating-banner">
        <Activity className="size-4" />
        <AlertTitle>Authenticating</AlertTitle>
        <AlertDescription>
          Waiting for the session boundary to confirm your credentials.
        </AlertDescription>
      </Alert>
    );
  }

  if (reason === 'refresh-failed') {
    return (
      <Alert className="border-amber-300/40 bg-amber-50 text-amber-950" data-testid="refresh-required-banner">
        <TriangleAlert className="size-4" />
        <AlertTitle>Refresh failed</AlertTitle>
        <AlertDescription>
          Session recovery failed. Sign in again before opening protected workflows.
        </AlertDescription>
      </Alert>
    );
  }

  if (reason === 'expired') {
    return (
      <Alert className="border-amber-300/40 bg-amber-50 text-amber-950" data-testid="session-expired-banner">
        <TriangleAlert className="size-4" />
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription>
          Your previous access token expired. Sign in again to continue safely.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-cyan-200 bg-cyan-50 text-cyan-950" data-testid="signed-out-banner">
      <ShieldAlert className="size-4" />
      <AlertTitle>Signed out</AlertTitle>
      <AlertDescription>Sign in with a valid staff account to continue.</AlertDescription>
    </Alert>
  );
}

export function LoginPage() {
  const { authStatus, login, session, sessionNotice } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (session) {
    return <Navigate replace to={resolveHomePath(session.role)} />;
  }

  const locationState = (location.state as LocationState | null) ?? null;
  const nextPath = locationState?.from?.pathname;
  const reason = locationState?.reason ?? sessionNotice;
  const isSubmitting = authStatus === 'authenticating';
  const sessionBanner = renderSessionBanner(reason, authStatus);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);

    try {
      const nextSession = await login(username.trim(), password);
      navigate(nextPath ?? resolveHomePath(nextSession.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        setErrorCode(error.code);
      } else {
        setErrorMessage('Unable to sign in right now.');
        setErrorCode('UNKNOWN_ERROR');
      }
    }
  }

  return (
    <div
      className="medical-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8"
      data-auth-status={authStatus}
      data-session-notice={reason ?? 'none'}
      data-testid="login-page"
    >
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-5 xl:grid-cols-[minmax(0,1.25fr)_440px]">
        <section className="dashboard-card overflow-hidden p-0">
          <div className="flex h-[70px] items-center justify-between border-b border-border px-7">
            <div className="flex items-center gap-3">
              <div className="brand-mark flex size-9 items-center justify-center rounded-xl">
                <GalleryVerticalEnd className="size-5" />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-950">MediCore HMS</span>
            </div>
            <Badge className="brand-soft rounded-lg" variant="secondary">
              OPD frontline
            </Badge>
          </div>

          <div className="grid gap-6 p-7 lg:grid-cols-[1fr_0.75fr] lg:p-10">
            <div className="space-y-8">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-balance text-5xl font-bold tracking-[-0.06em] text-slate-950">
                  Hospital Management UI runtime
                </h1>
                <p className="text-pretty max-w-2xl text-lg leading-8 text-muted-foreground">
                  Sign in with current staff accounts to verify role-aware routing, guarded access,
                  and fail-closed authentication before operational modules expand.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {roleCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div key={card.label} className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                          <Icon className="size-4" />
                        </div>
                        <p className="tabular text-2xl font-bold tracking-[-0.05em] text-cyan-700">{card.metric}</p>
                      </div>
                      <p className="mt-5 font-semibold">{card.label}</p>
                      <p className="text-pretty mt-2 text-sm leading-6 text-muted-foreground">{card.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">System readiness</p>
                  <p className="text-sm text-muted-foreground">Authentication boundary</p>
                </div>
                <Activity className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-8 flex h-[260px] items-end justify-between gap-3">
                {[58, 76, 62, 84, 48, 71, 54].map((height, index) => (
                  <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-[210px] w-full items-end">
                      <div
                        className="w-full rounded-t-xl rounded-b-lg bg-cyan-600"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Card className="dashboard-card justify-center border-border bg-white py-7">
          <CardHeader className="space-y-3">
            <Badge className="rounded-lg" variant="secondary">
              Sign in
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-[-0.04em]">
                Use current seeded backend accounts
              </CardTitle>
              <CardDescription className="leading-7">
                admin / reception / doctor all currently default to <code>secret123</code> in the
                Node backend scaffold.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {sessionBanner}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <Input
                  autoComplete="username"
                  className="h-11 rounded-lg"
                  data-testid="username-input"
                  id="username"
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  autoComplete="current-password"
                  className="h-11 rounded-lg"
                  data-testid="password-input"
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>

              {errorMessage ? (
                <Alert data-error-code={errorCode ?? 'UNKNOWN_ERROR'} data-testid="login-error-banner" variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                aria-busy={isSubmitting}
                className="brand-button h-11 w-full rounded-lg"
                data-testid="login-submit-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <Separator />

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                  <Activity className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Fail-closed verification note</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    If session recovery fails, the UI surfaces the problem instead of pretending
                    operational access is still safe.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
