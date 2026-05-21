# Node Backend

Express + TypeScript backend scaffold for the Hospital Management System.

## Tech Stack
- Runtime: Node.js 20+
- Framework: Express
- Validation: Zod
- ORM: Prisma
- Database: PostgreSQL
- Logging: Pino
- Testing: Vitest + Supertest

## Persistence Contract
- The authoritative M001 backend persistence path is the shared Prisma/PostgreSQL repository contract validated in R007 and recorded by D027/D028.
- Auth and OPD repositories import the shared database client instead of creating per-request clients or bypassing repository seams.
- PostgreSQL datasource and Prisma Client generation are defined in the Prisma schema, while repository-bounded writes own transactional behavior where the runtime needs it.
- The executable proof lives in the persistence-contract architecture test plus representative auth/OPD route suites; if those fail, treat the persistence contract as drifted rather than inferring intent from older milestone notes.

## Quick Start
```bash
cp node-backend/.env.example node-backend/.env
npm --prefix node-backend install
npm --prefix node-backend run test
npm --prefix node-backend run dev
```

## API Docs
- Swagger UI is available in development and test environments at `http://localhost:3000/api/v1/docs`
- The OpenAPI JSON document is available at `http://localhost:3000/api/v1/openapi.json`
- Swagger routes are intentionally disabled when `NODE_ENV=production`

## Production Deployment
- Production backend delivery now follows: GitHub push -> GitHub Actions test/build -> Docker image push to GHCR -> SSH deploy to AWS EC2 -> EC2 pulls the new image and restarts the container.
- Use `DEPLOYMENT.md` as the canonical runbook for required GitHub secrets, EC2 bootstrap, and rollout details.

## Current Scope
- Health endpoint scaffolded at `/api/v1/healthz`
- Live auth surface available today at `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/refresh`, and `/api/v1/auth/logout`
- RBAC probe routes are available at `/api/v1/probe/admin`, `/api/v1/probe/receptionist`, and `/api/v1/probe/doctor`; each route resolves the principal from the bearer token subject plus DB lookup and only trusts the DB role for authorization
- `/api/v1/probe/unscoped` is intentionally deny-by-default and returns a deterministic 403 envelope so missing route policy wiring fails closed
- Seeded local accounts available for stage-like verification: `admin`, `reception`, and `doctor` with password `secret123`
- Auth/RBAC shell proof is available against the React frontend, and the Node backend now owns the OPD patient registration plus appointment scheduling/update contract under `/api/v1/patients` and `/api/v1/appointments`
- Reception scheduling can discover live schedulable doctors through the read-only `/api/v1/doctors` contract, which returns only active doctor principals in deterministic `username -> id` order and fails closed as `OPD_UNAVAILABLE` on lookup or shape errors
- Doctor queue ownership is server-derived from the authenticated doctor principal under `/api/v1/doctor/queue`; live queue reads return only active appointments (`SCHEDULED`, `CHECKED_IN`) in deterministic `scheduledAt -> createdAt -> id` order with patient context and fail closed as `OPD_UNAVAILABLE`
- Assigned doctors can advance only their own queue lifecycle through `PATCH /api/v1/doctor/queue/:appointmentId` with strict `{ version, status }` input, optimistic concurrency, and allowed forward transitions `SCHEDULED -> CHECKED_IN -> COMPLETED`
- The frontend workspace ships a repo-tracked localhost verifier at `frontend/scripts/verify-s16-live.mjs` (run with `npm --prefix frontend run verify:s16:live`) that proves the assembled receptionist→doctor flow against this backend and emits stable browser assertion targets without claiming admin delivery is live
- The frontend workspace also ships `frontend/scripts/verify-s17-live.mjs` (run with `npm --prefix frontend run verify:s17:live`) to prove the live admin department setup → receptionist scheduling → doctor queue journey with redacted JSON evidence and browser-checklist selectors
- Persistence proof is intentionally concentrated in three seams future agents should consult together: the Prisma schema for datasource/client generation, the shared database client plus auth/OPD repositories for lifecycle/repository boundaries, and `tests/architecture/persistence-contract.test.ts` for fail-loud contract assertions
- OPD route tests and OpenAPI assertions lock the patient/appointment/doctor-queue contracts with deterministic `error.code` responses for validation, RBAC denial, wrong-owner denial, invalid lifecycle transitions, stale-version conflicts, missing references, and temporary repository unavailability
