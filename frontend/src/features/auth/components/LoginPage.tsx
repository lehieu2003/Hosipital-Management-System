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
import { ApiError } from '@/api';

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
    copy: 'Administrative boundaries, staffing controls, and role-protected oversight.',
    icon: ShieldCheck,
    label: 'Admin',
    metric: 'Secure',
  },
  {
    copy: 'Patient intake, appointment booking, and doctor directory scheduling.',
    icon: CalendarClock,
    label: 'Reception',
    metric: 'Live',
  },
  {
    copy: 'Queue progression, refresh recovery, and visit lifecycle updates.',
    icon: Stethoscope,
    label: 'Doctor',
    metric: 'Ready',
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
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-5 xl:grid-cols-[minmax(0,1.15fr)_460px]">
        <section className="dashboard-card overflow-hidden p-0">
          <div className="flex h-[74px] items-center justify-between border-b border-border px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="brand-mark flex size-10 items-center justify-center rounded-2xl shadow-sm">
                <GalleryVerticalEnd className="size-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-sm font-semibold tracking-tight text-slate-950">MediCore HMS</span>
                <span className="block text-xs text-slate-500">Clinical operations</span>
              </div>
            </div>
            <Badge className="rounded-full px-3 py-1" variant="secondary">
              OPD frontline
            </Badge>
          </div>

          <div className="grid gap-8 p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-10 xl:p-12">
            <div className="space-y-8">
              <div className="max-w-3xl space-y-4">
                <Badge className="rounded-full px-3 py-1" variant="outline">
                  Role-aware access
                </Badge>
                <h1 className="text-balance text-5xl font-bold tracking-[-0.06em] text-slate-950">
                  Hospital operations, without ambiguous access.
                </h1>
                <p className="text-pretty max-w-2xl text-lg leading-8 text-muted-foreground">
                  Sign in with the current staff accounts to verify routing, guarded workflows, and
                  fail-closed authentication before entering operational screens.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {roleCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.label}
                      className="rounded-3xl border border-cyan-100/80 bg-white/88 p-5 shadow-sm ring-1 ring-white/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                          <Icon className="size-4" />
                        </div>
                        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                          {card.metric}
                        </span>
                      </div>
                      <p className="mt-5 text-base font-semibold text-slate-950">{card.label}</p>
                      <p className="text-pretty mt-2 text-sm leading-6 text-muted-foreground">{card.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[32px] border border-cyan-100/80 bg-white/88 p-6 shadow-sm ring-1 ring-white/70 lg:p-7">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">System readiness</p>
                      <p className="text-sm text-muted-foreground">Authentication boundary</p>
                    </div>
                    <Activity className="size-5 text-cyan-700" />
                  </div>
                  <div className="mt-5 grid gap-3">
                    <ReadinessRow label="Role-aware routing" value="Verified" />
                    <ReadinessRow label="Refresh replay" value="Fail-closed" />
                    <ReadinessRow label="Operational shells" value="Protected" />
                  </div>
                </div>

                <div className="rounded-3xl border border-cyan-100/80 bg-cyan-50/65 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                      <Activity className="size-4" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-slate-950">Fail-closed verification note</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        If session recovery fails, the UI surfaces the problem instead of pretending
                        operational access is still safe.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Card className="dashboard-card justify-center border-border bg-white/92 py-7">
          <CardHeader className="space-y-3">
            <Badge className="rounded-full px-3 py-1" variant="secondary">
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
                  className="h-11 rounded-xl"
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
                  className="h-11 rounded-xl"
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
                className="brand-button h-11 w-full rounded-xl"
                data-testid="login-submit-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <Separator />

            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-950">Current access model</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>• Admin, receptionist, and doctor routes resolve to different protected homes.</li>
                <li>• Invalid credentials stay machine-readable at the login boundary.</li>
                <li>• Refresh failures route back here instead of leaking access.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReadinessRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/85 px-3 py-3 text-sm shadow-sm ring-1 ring-white/70">
      <span className="text-slate-500">{props.label}</span>
      <span className="font-semibold text-slate-950">{props.value}</span>
    </div>
  );
}
