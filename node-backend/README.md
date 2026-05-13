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

## Current Scope
- Health endpoint scaffolded at `/api/v1/healthz`
- Error envelope and structured logging in place
- Auth/RBAC/appointments migration still pending from the legacy Python backend
