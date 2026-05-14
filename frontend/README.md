# Frontend Workspace

React + Vite + TypeScript SPA for the OPD frontend foundation.

## Purpose

This workspace owns the browser runtime for M001:

- public landing page at `/`
- login flow at `/login`
- protected app shell under `/app/*`
- role-aware navigation for Admin, Receptionist, and Doctor
- backend adapter seams for auth/session and future OPD contracts

The frontend is intentionally kept separate from the backend runtime. It does not assume SSR and it does not bind the shell to legacy FastAPI-only transport details.

## Stack

- React 19
- Vite 8
- TypeScript 6 (strict-ish app config)
- Tailwind CSS 4
- React Router 7
- TanStack Query 5
- Vitest + Testing Library

## Quick Start

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Default app URL:

- `http://localhost:5173`

Default API base URL when unset:

- `http://localhost:3000/api/v1`

## Environment

Set frontend runtime config with Vite environment variables:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

`src/lib/config.ts` is the canonical place for reading browser runtime configuration.

## Route Foundation

- `/` — public landing page
- `/login` — sign-in entrypoint
- `/app` — authenticated redirect based on role
- `/app/admin` — admin shell landing
- `/app/reception/scheduling` — receptionist scheduling shell
- `/app/doctor/queue` — doctor queue shell

## Runtime Seams

### Auth/session

`src/lib/auth/session.ts` defines the typed client session model and storage helpers.

`src/features/auth/stores/auth-provider.tsx` owns:

- login
- logout
- boot-time session validation
- refresh-on-expiry handling
- fail-closed transition to `refresh-failed`

### API boundary

`src/lib/api/client.ts` is the stable HTTP seam for future contract wiring. It currently provides:

- base URL normalization
- cookie-aware requests
- bearer token injection from a session manager
- one-time refresh + replay on expired access tokens
- normalized error codes for `AUTH_EXPIRED`, `REFRESH_FAILED`, `FORBIDDEN`, `CONFLICT`, and `UNAVAILABLE`

Downstream slices should wire endpoint-specific modules through this client rather than baking transport behavior directly into pages.

## Observability Surfaces

The frontend foundation exposes deterministic machine-readable signals for later tasks and browser verification:

- `data-testid="landing-page"`
- `data-testid="login-page"`
- `data-testid="auth-loading-state"`
- `data-testid="app-shell"`
- `data-testid="primary-navigation"`
- `data-testid="refresh-failed-banner"`
- `data-testid="refresh-required-banner"`
- `data-testid="login-error-banner"`

The protected shell also exposes:

- `data-role` on `app-shell`
- `data-auth-status` on `app-shell`
- `data-session-notice` on `app-shell`
- `data-session-notice` on `login-page`

Additional operational-state surfaces:

- `data-testid="route-forbidden-state"`
- `data-testid="admin-overview-loading-state"`
- `data-testid="admin-overview-unavailable-state"`
- `data-testid="reception-scheduling-loading-state"`
- `data-testid="reception-scheduling-unavailable-state"`
- `data-testid="doctor-queue-loading-state"`
- `data-testid="doctor-queue-unavailable-state"`
- `data-screen-status` on operational state cards
- `data-screen-code` on operational state cards

These are the preferred diagnostics for auth/session, role gating, and fail-closed operational checks.

## Testing

Run the task verification command:

```bash
npm --prefix frontend run test -- --runInBand
```

Useful focused commands during iteration:

```bash
npm --prefix frontend run test -- --runInBand src/tests/unit/auth/AuthShell.test.tsx
npm --prefix frontend run test -- --runInBand src/tests/unit/opd/OperationalFoundations.test.tsx
```

Current coverage in the foundation layer includes:

- route shell smoke tests
- config default/override tests
- API client refresh + replay behavior
- fail-closed auth refresh recovery and login-boundary transitions
- role-aware navigation and shell observability tests
- fail-closed operational foundation states for unwired OPD contracts

## Notes for Future Slices

- Keep protected application work under `/app/*`.
- Prefer direct feature/module imports with the `@/` alias.
- Avoid adding global state beyond the existing auth provider unless a later slice proves it is necessary.
- Keep backend-specific endpoint assumptions behind the API client and feature adapters.
