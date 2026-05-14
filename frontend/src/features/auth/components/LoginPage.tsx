import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
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
};

const roleCards = [
  {
    copy: 'Reserved for staffing boundaries, department controls, and admin-only settings.',
    icon: ShieldCheck,
    label: 'Admin',
    title: 'Configuration shell',
  },
  {
    copy: 'Prepared for patient intake and appointment booking without speculative fields.',
    icon: CalendarClock,
    label: 'Reception',
    title: 'Scheduling workspace',
  },
  {
    copy: 'Prepared for live queue polling, refresh recovery, and consultation progression.',
    icon: Stethoscope,
    label: 'Doctor',
    title: 'Queue workspace',
  },
];

export function LoginPage() {
  const { authStatus, login, session } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return <Navigate replace to={resolveHomePath(session.role)} />;
  }

  const nextPath = (location.state as LocationState | null)?.from?.pathname;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const nextSession = await login(username.trim(), password);
      navigate(nextPath ?? resolveHomePath(nextSession.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to sign in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <Card className="relative overflow-hidden border-primary/10 bg-slate-950 text-slate-50 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.2),transparent_28%)]" />
          <CardHeader className="relative gap-6 p-6 sm:p-8 lg:p-10">
            <div className="space-y-4">
              <Badge className="w-fit bg-white/10 text-white hover:bg-white/10" variant="outline">
                OPD frontline
              </Badge>
              <div className="space-y-3">
                <CardTitle className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Hospital Management UI runtime
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  Sign in with current staff accounts to verify role-aware routing, guarded access,
                  and fail-closed authentication before the operational modules expand.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative grid gap-4 px-6 pb-6 sm:px-8 sm:pb-8 lg:grid-cols-3 lg:px-10 lg:pb-10">
            {roleCards.map((card) => {
              const Icon = card.icon;

              return (
                <Card key={card.label} className="border-white/10 bg-white/8 text-white shadow-none backdrop-blur">
                  <CardHeader className="gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-2">
                      <Badge className="w-fit border-white/15 text-white" variant="outline">
                        {card.label}
                      </Badge>
                      <CardTitle className="text-lg text-white">{card.title}</CardTitle>
                      <CardDescription className="text-sm leading-6 text-slate-300">
                        {card.copy}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        <Card className="justify-center border-border/70 bg-background/90 shadow-lg">
          <CardHeader className="space-y-3">
            <Badge variant="secondary">Sign in</Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl">Use current seeded backend accounts</CardTitle>
              <CardDescription className="leading-7">
                admin / reception / doctor — all currently default to <code>secret123</code> in
                the backend scaffold.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <Input
                  autoComplete="username"
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
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>

              {authStatus === 'refresh-failed' ? (
                <Alert className="border-amber-300/40 bg-amber-50 text-amber-950" data-testid="refresh-required-banner">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Refresh failed</AlertTitle>
                  <AlertDescription>
                    Session refresh failed. Sign in again to continue safely.
                  </AlertDescription>
                </Alert>
              ) : null}

              {errorMessage ? (
                <Alert data-testid="login-error-banner" variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <Separator />

            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Fail-closed verification note</p>
                  <p className="text-muted-foreground text-sm leading-6">
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
