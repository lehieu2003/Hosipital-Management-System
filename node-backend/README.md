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

## Current Scope
- Health endpoint scaffolded at `/api/v1/healthz`
- Live auth surface available today at `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/refresh`, and `/api/v1/auth/logout`
- Seeded local accounts available for stage-like verification: `admin`, `reception`, and `doctor` with password `secret123`
- Auth/RBAC shell proof is available against the React frontend, but admin operational data, reception scheduling data, and doctor queue data still intentionally stop at `CONTRACT_PENDING`
- Appointments and broader OPD contract migration are still pending from the legacy Python backend
