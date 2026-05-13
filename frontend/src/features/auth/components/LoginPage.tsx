import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api';

import { resolveHomePath } from '../index';
import { useAuth } from '../hooks/use-auth';

type LocationState = {
  from?: {
    pathname: string;
  };
};

const roleCards = [
  {
    copy: 'Reserved for staffing, access boundaries, and department controls once admin APIs land.',
    label: 'Admin',
    title: 'Configuration shell',
  },
  {
    copy: 'Prepared for patient registration and appointment booking without speculative fields.',
    label: 'Reception',
    title: 'Scheduling workspace',
  },
  {
    copy: 'Prepared for live queue polling, refresh recovery, and consultation status flow.',
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
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/65 shadow-[var(--shadow-panel)] backdrop-blur xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <section className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,111,237,0.35),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                OPD frontline
              </div>
              <h1 className="mt-6 max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
                Hospital Management UI runtime
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Sign in with the seeded staff accounts to verify role-aware navigation, guarded
                routes, and fail-closed authentication behaviour before operational modules land.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {roleCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-[1.75rem] border border-white/12 bg-white/8 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-100">
                    {card.label}
                  </p>
                  <strong className="mt-3 block text-lg font-bold tracking-tight text-white">
                    {card.title}
                  </strong>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center bg-white/85 px-5 py-8 sm:px-7 lg:px-8">
          <div className="w-full space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
                Sign in
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                Use current seeded backend accounts
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                admin / reception / doctor — all default to <code>secret123</code> in the current
                backend scaffold.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-800">Username</span>
                <input
                  autoComplete="username"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-800">Password</span>
                <input
                  autoComplete="current-password"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              {authStatus === 'refresh-failed' ? (
                <p
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
                  data-testid="refresh-required-banner"
                >
                  Session refresh failed. Sign in again to continue.
                </p>
              ) : null}

              {errorMessage ? (
                <p
                  className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700"
                  data-testid="login-error-banner"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-600 to-mint-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-200/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-200/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                Verification note
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This screen is intentionally explicit: if session recovery fails, the UI surfaces
                it instead of pretending operational access is still safe.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
