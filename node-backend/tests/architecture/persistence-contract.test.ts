import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, '..', '..');

const contractFiles = {
  prismaSchema: path.join(backendRoot, 'prisma', 'schema.prisma'),
  dbClient: path.join(backendRoot, 'src', 'infrastructure', 'database', 'client.ts'),
  authRepository: path.join(backendRoot, 'src', 'domain', 'repositories', 'auth.repository.ts'),
  authUsers: path.join(backendRoot, 'src', 'domain', 'repositories', 'auth', 'auth.users.ts'),
  authRefreshSessions: path.join(backendRoot, 'src', 'domain', 'repositories', 'auth', 'auth.refresh-sessions.ts'),
  opdRepository: path.join(backendRoot, 'src', 'domain', 'repositories', 'opd.repository.ts'),
  opdPatients: path.join(backendRoot, 'src', 'domain', 'repositories', 'opd', 'opd.patients.ts'),
  opdDepartments: path.join(backendRoot, 'src', 'domain', 'repositories', 'opd', 'opd.departments.ts'),
  opdAppointments: path.join(backendRoot, 'src', 'domain', 'repositories', 'opd', 'opd.appointments.ts'),
  ipdRepository: path.join(backendRoot, 'src', 'domain', 'repositories', 'ipd.repository.ts'),
  ipdQueries: path.join(backendRoot, 'src', 'domain', 'repositories', 'ipd', 'ipd.queries.ts'),
  ipdBedWorkflows: path.join(backendRoot, 'src', 'domain', 'repositories', 'ipd', 'ipd.bed-workflows.ts'),
  billingRepository: path.join(backendRoot, 'src', 'domain', 'repositories', 'billing.repository.ts'),
  billingQueries: path.join(backendRoot, 'src', 'domain', 'repositories', 'billing', 'billing.queries.ts'),
  billingWorkflows: path.join(backendRoot, 'src', 'domain', 'repositories', 'billing', 'billing.workflows.ts'),
  packageJson: path.join(backendRoot, 'package.json'),
} as const;

const readTrackedSource = (filePath: string) => {
  expect(existsSync(filePath), `Missing tracked persistence contract file: ${path.relative(backendRoot, filePath)}`).toBe(true);
  return readFileSync(filePath, 'utf8');
};

const expectIncludes = (source: string, needle: string, filePath: string, contractPhrase: string) => {
  expect(
    source,
    `${path.relative(backendRoot, filePath)} must include ${contractPhrase}`,
  ).toContain(needle);
};

const expectExcludes = (source: string, needle: string, filePath: string, contractPhrase: string) => {
  expect(
    source,
    `${path.relative(backendRoot, filePath)} must not include ${contractPhrase}`,
  ).not.toContain(needle);
};

const expectMatches = (source: string, pattern: RegExp, filePath: string, contractPhrase: string) => {
  expect(
    source,
    `${path.relative(backendRoot, filePath)} must match ${contractPhrase}`,
  ).toMatch(pattern);
};

describe('authoritative Node persistence contract', () => {
  it('pins the tracked Prisma schema and backend toolchain to Prisma Client + PostgreSQL', () => {
    const schemaSource = readTrackedSource(contractFiles.prismaSchema);
    const packageSource = readTrackedSource(contractFiles.packageJson);

    expectMatches(
      schemaSource,
      /generator\s+client\s*\{[\s\S]*provider\s*=\s*"prisma-client-js"[\s\S]*\}/m,
      contractFiles.prismaSchema,
      'generator client provider "prisma-client-js"',
    );
    expectMatches(
      schemaSource,
      /datasource\s+db\s*\{[\s\S]*provider\s*=\s*"postgresql"[\s\S]*\}/m,
      contractFiles.prismaSchema,
      'datasource db provider "postgresql"',
    );
    expectIncludes(
      schemaSource,
      'url      = env("DATABASE_URL")',
      contractFiles.prismaSchema,
      'DATABASE_URL datasource binding',
    );
    expectIncludes(
      packageSource,
      '"@prisma/client"',
      contractFiles.packageJson,
      '@prisma/client dependency',
    );
    expectIncludes(packageSource, '"prisma"', contractFiles.packageJson, 'prisma dependency');
    expectIncludes(
      schemaSource,
      'enum InpatientAdmissionStatus',
      contractFiles.prismaSchema,
      'inpatient admission status enum',
    );
    expectIncludes(
      schemaSource,
      'enum BedMovementType',
      contractFiles.prismaSchema,
      'bed movement type enum',
    );
    expectIncludes(
      schemaSource,
      'model InpatientAdmission',
      contractFiles.prismaSchema,
      'inpatient admission model',
    );
    expectIncludes(schemaSource, 'model Bed', contractFiles.prismaSchema, 'bed inventory model');
    expectIncludes(
      schemaSource,
      'model BedOccupancy',
      contractFiles.prismaSchema,
      'current occupancy model',
    );
    expectIncludes(
      schemaSource,
      'model InpatientBedMovement',
      contractFiles.prismaSchema,
      'append-only bed movement history model',
    );
  });

  it('proves the shared Prisma client singleton is the only auth/OPD/IPD repository seam', () => {
    const clientSource = readTrackedSource(contractFiles.dbClient);
    const authRepositorySource = readTrackedSource(contractFiles.authRepository);
    const authUsersSource = readTrackedSource(contractFiles.authUsers);
    const authRefreshSessionsSource = readTrackedSource(contractFiles.authRefreshSessions);
    const opdRepositorySource = readTrackedSource(contractFiles.opdRepository);
    const opdPatientsSource = readTrackedSource(contractFiles.opdPatients);
    const opdDepartmentsSource = readTrackedSource(contractFiles.opdDepartments);
    const opdAppointmentsSource = readTrackedSource(contractFiles.opdAppointments);
    const ipdRepositorySource = readTrackedSource(contractFiles.ipdRepository);
    const ipdQueriesSource = readTrackedSource(contractFiles.ipdQueries);
    const ipdBedWorkflowsSource = readTrackedSource(contractFiles.ipdBedWorkflows);
    const billingRepositorySource = readTrackedSource(contractFiles.billingRepository);
    const billingQueriesSource = readTrackedSource(contractFiles.billingQueries);
    const billingWorkflowsSource = readTrackedSource(contractFiles.billingWorkflows);

    expectIncludes(
      clientSource,
      "import { PrismaClient } from '@prisma/client';",
      contractFiles.dbClient,
      'PrismaClient import',
    );
    expectIncludes(
      clientSource,
      'export const db =',
      contractFiles.dbClient,
      'shared db export',
    );
    expectIncludes(
      clientSource,
      'globalForPrisma.prisma ??',
      contractFiles.dbClient,
      'global singleton reuse guard',
    );
    expectIncludes(
      clientSource,
      'new PrismaClient({',
      contractFiles.dbClient,
      'PrismaClient construction',
    );
    expectIncludes(
      clientSource,
      'globalForPrisma.prisma = db;',
      contractFiles.dbClient,
      'non-production singleton caching',
    );

    for (const [repositoryPath, repositorySource, dbImport] of [
      [
        contractFiles.authUsers,
        authUsersSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.authRefreshSessions,
        authRefreshSessionsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.opdPatients,
        opdPatientsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.opdDepartments,
        opdDepartmentsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.opdAppointments,
        opdAppointmentsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.ipdQueries,
        ipdQueriesSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.ipdBedWorkflows,
        ipdBedWorkflowsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.billingQueries,
        billingQueriesSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
      [
        contractFiles.billingWorkflows,
        billingWorkflowsSource,
        "import { db } from '../../../infrastructure/database/client.js';",
      ],
    ] as const) {
      expectIncludes(
        repositorySource,
        dbImport,
        repositoryPath,
        'shared db client import',
      );
      expectExcludes(
        repositorySource,
        'new PrismaClient(',
        repositoryPath,
        'local PrismaClient construction',
      );
      expectExcludes(
        repositorySource,
        'PrismaClient',
        repositoryPath,
        'direct PrismaClient usage outside the shared db client seam',
      );
    }

    expectIncludes(
      authRepositorySource,
      "import { AuthUserQueries } from './auth/auth.users.js';",
      contractFiles.authRepository,
      'Auth user module facade import',
    );
    expectIncludes(
      authRepositorySource,
      "import { AuthRefreshSessionQueries } from './auth/auth.refresh-sessions.js';",
      contractFiles.authRepository,
      'Auth refresh-session module facade import',
    );
    expectIncludes(
      opdRepositorySource,
      "import { OpdPatientQueries } from './opd/opd.patients.js';",
      contractFiles.opdRepository,
      'OPD patient module facade import',
    );
    expectIncludes(
      opdRepositorySource,
      "import { OpdDepartmentQueries } from './opd/opd.departments.js';",
      contractFiles.opdRepository,
      'OPD department module facade import',
    );
    expectIncludes(
      opdRepositorySource,
      "import { OpdAppointmentQueries } from './opd/opd.appointments.js';",
      contractFiles.opdRepository,
      'OPD appointment module facade import',
    );
    expectIncludes(
      ipdRepositorySource,
      "import { IpdQueries } from './ipd/ipd.queries.js';",
      contractFiles.ipdRepository,
      'IPD query module facade import',
    );
    expectIncludes(
      ipdRepositorySource,
      "import { IpdBedWorkflows } from './ipd/ipd.bed-workflows.js';",
      contractFiles.ipdRepository,
      'IPD workflow module facade import',
    );
    expectIncludes(
      billingRepositorySource,
      "import { BillingQueries } from './billing/billing.queries.js';",
      contractFiles.billingRepository,
      'Billing query module facade import',
    );
    expectIncludes(
      billingRepositorySource,
      "BillingWorkflows",
      contractFiles.billingRepository,
      'Billing workflow module facade import',
    );

    expectMatches(
      authUsersSource,
      /await\s+db\.user\.findUnique\(/,
      contractFiles.authUsers,
      'shared db user lookup seam',
    );
    expectMatches(
      authRefreshSessionsSource,
      /await\s+db\.refreshSession\.findUnique\(/,
      contractFiles.authRefreshSessions,
      'shared db refresh-session lookup seam',
    );
    expectMatches(
      opdPatientsSource,
      /await\s+db\.patient\.create\(/,
      contractFiles.opdPatients,
      'shared db patient write seam',
    );
    expectMatches(
      opdDepartmentsSource,
      /await\s+db\.\$transaction\(/,
      contractFiles.opdDepartments,
      'shared db OPD department transaction seam',
    );
    expectMatches(
      opdAppointmentsSource,
      /await\s+db\.\$transaction\(/,
      contractFiles.opdAppointments,
      'shared db OPD appointment transaction seam',
    );
    expectMatches(
      ipdQueriesSource,
      /await\s+db\.inpatientAdmission\.create\(/,
      contractFiles.ipdQueries,
      'shared db inpatient admission write seam',
    );
    expectMatches(
      ipdBedWorkflowsSource,
      /await\s+db\.\$transaction\(/,
      contractFiles.ipdBedWorkflows,
      'shared db IPD transaction seam',
    );
    expectMatches(
      billingQueriesSource,
      /await\s+db\.billingInvoice\.findUnique\(/,
      contractFiles.billingQueries,
      'shared db billing invoice lookup seam',
    );
    expectMatches(
      billingWorkflowsSource,
      /await\s+db\.\$transaction\(/,
      contractFiles.billingWorkflows,
      'shared db billing transaction seam',
    );
  });

  it('fails closed if direct SQL or driver APIs appear in the authoritative auth/OPD/IPD/billing repositories', () => {
    for (const repositoryPath of [
      contractFiles.authRepository,
      contractFiles.authUsers,
      contractFiles.authRefreshSessions,
      contractFiles.opdRepository,
      contractFiles.opdPatients,
      contractFiles.opdDepartments,
      contractFiles.opdAppointments,
      contractFiles.ipdRepository,
      contractFiles.ipdQueries,
      contractFiles.ipdBedWorkflows,
      contractFiles.billingRepository,
      contractFiles.billingQueries,
      contractFiles.billingWorkflows,
    ]) {
      const repositorySource = readTrackedSource(repositoryPath);

      for (const forbiddenDriverImport of [
        "from 'pg'",
        'from "pg"',
        "from 'mysql2'",
        'from "mysql2"',
        "from 'mysql'",
        'from "mysql"',
        "from 'node:sqlite'",
        'from "node:sqlite"',
        "from 'better-sqlite3'",
        'from "better-sqlite3"',
      ]) {
        expectExcludes(
          repositorySource,
          forbiddenDriverImport,
          repositoryPath,
          `forbidden driver import ${forbiddenDriverImport}`,
        );
      }

      for (const forbiddenRawSqlSeam of [
        '.$queryRaw',
        '.$executeRaw',
        '.$queryRawUnsafe',
        '.$executeRawUnsafe',
        'SELECT ',
        'INSERT ',
        'UPDATE ',
        'DELETE ',
      ]) {
        expectExcludes(
          repositorySource,
          forbiddenRawSqlSeam,
          repositoryPath,
          `forbidden raw-SQL seam ${forbiddenRawSqlSeam}`,
        );
      }
    }
  });
});
