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

### S10 live localhost rerun

Use this when you need stage-like proof against the real React frontend plus the live Node auth backend.

Start both runtimes:

```bash
npm --prefix node-backend run dev
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Then run the tracked verifier:

```bash
node frontend/scripts/verify-s10-live.mjs
```

What the verifier proves before any browser work begins:

- `http://127.0.0.1:5173/` and `/login` are reachable and still serving the Vite HTML shell.
- `VITE_API_BASE_URL` resolves to the expected local Node auth base URL (or falls back to `http://localhost:3000/api/v1` when unset).
- `/api/v1/healthz` is healthy.
- `/api/v1/auth/login` rejects bad credentials with `INVALID_CREDENTIALS`.
- `/api/v1/auth/login`, `/api/v1/auth/me`, and `/api/v1/auth/refresh` all work for the seeded `doctor` account.
- Refresh replay is still fail-closed with `REVOKED_REFRESH_TOKEN`.

Seeded live credentials:

| Role | Username | Password | Expected landing route |
| --- | --- | --- | --- |
| Admin | `admin` | `secret123` | `/app/admin` |
| Receptionist | `reception` | `secret123` | `/app/reception/scheduling` |
| Doctor | `doctor` | `secret123` | `/app/doctor/queue` |

Browser rerun matrix after the script passes:

| Flow | Route / action | Required assertions |
| --- | --- | --- |
| Login boundary | `/login` | `data-testid="login-page"` is visible and the seeded-account copy is present. |
| Admin auth shell | login as `admin` | `data-testid="app-shell"`, `data-role="admin"`, `data-auth-status="authenticated"`, `data-testid="admin-overview-unavailable-state"`, `data-screen-code="CONTRACT_PENDING"`, `data-screen-status="unavailable"`. |
| Receptionist auth shell | login as `reception` | `data-testid="app-shell"`, `data-role="receptionist"`, `data-testid="reception-scheduling-unavailable-state"`, `data-screen-code="CONTRACT_PENDING"`. |
| Forbidden route denial | receptionist opens `/app/admin` directly | `data-testid="route-forbidden-state"` while the shell still reports `data-role="receptionist"`. |
| Doctor auth shell | login as `doctor` | `data-testid="app-shell"`, `data-role="doctor"`, `data-testid="doctor-queue-unavailable-state"`, `data-screen-code="CONTRACT_PENDING"`. |
| Refresh-failure logout | sign out, inject an expired session into `sessionStorage['hms.frontend.session']`, then open `/app/admin` | bounded return to `/login`, `data-testid="refresh-required-banner"`, and login-page `data-auth-status="refresh-failed"`. |

Blocker-aware acceptance rule for S10:

- `CONTRACT_PENDING` on admin, reception scheduling, and doctor queue is the **expected** truthful state for this slice.
- Treat any happy-path operational data on those screens as a failure for S10 because the live Node admin, scheduling, and queue contracts are not wired yet.
- S10 proves the real auth/RBAC shell, guarded-route denial, and refresh boundaries only; full R010 operational closure still depends on the future Node OPD contracts.

### S16 live localhost rerun

Use this when you need a repo-tracked localhost verifier for the assembled receptionist→doctor runtime flow while still keeping admin delivery explicitly pending.

Start both runtimes:

```bash
npm --prefix node-backend run dev
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Then run the tracked verifier:

```bash
npm --prefix frontend run verify:s16:live
```

Environment overrides:

```bash
S16_FRONTEND_URL=http://127.0.0.1:5173
S16_API_BASE_URL=http://localhost:3000/api/v1
S16_VERIFY_TIMEOUT_MS=20000
```

What the verifier proves directly:

- frontend landing and login shells are reachable
- backend health is ready
- invalid credentials still fail with `INVALID_CREDENTIALS`
- seeded `admin`, `reception`, and `doctor` auth bootstrap cleanly through `/auth/login` and `/auth/me`
- receptionist can read the live doctor directory, register a patient, and create a `SCHEDULED` appointment
- doctor can see that appointment in `/doctor/queue`, move it to `CHECKED_IN`, then `COMPLETED`, and the completed item disappears from the active queue
- verifier output stays machine-readable JSON and redacts tokens, refresh cookies, and extra patient detail

What the verifier emits for browser/UAT replay after it finishes:

- admin pending selectors for `/app/admin`
- receptionist scheduling success selectors plus the created appointment ID, version, and registration number
- doctor queue selectors for the created appointment
- receptionist direct-admin denial selectors for `/app/admin`
- refresh fail-closed seed input for `sessionStorage['hms.frontend.session']` and the expected `/login` selectors

Scope guard for S16:

- Admin remains intentionally `CONTRACT_PENDING`; passing S16 does **not** claim live admin delivery.
- The script proves the real Node + React receptionist/doctor flow and the stable browser verification contract around it.

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
