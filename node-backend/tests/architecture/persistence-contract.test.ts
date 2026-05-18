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
  opdRepository: path.join(backendRoot, 'src', 'domain', 'repositories', 'opd.repository.ts'),
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
  });

  it('proves the shared Prisma client singleton is the only auth/OPD repository seam', () => {
    const clientSource = readTrackedSource(contractFiles.dbClient);
    const authRepositorySource = readTrackedSource(contractFiles.authRepository);
    const opdRepositorySource = readTrackedSource(contractFiles.opdRepository);

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

    for (const [repositoryPath, repositorySource] of [
      [contractFiles.authRepository, authRepositorySource],
      [contractFiles.opdRepository, opdRepositorySource],
    ] as const) {
      expectIncludes(
        repositorySource,
        "import { db } from '../../infrastructure/database/client.js';",
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

    expectMatches(
      authRepositorySource,
      /await\s+db\.user\.findUnique\(/,
      contractFiles.authRepository,
      'shared db user lookup seam',
    );
    expectMatches(
      opdRepositorySource,
      /await\s+db\.patient\.create\(/,
      contractFiles.opdRepository,
      'shared db patient write seam',
    );
    expectMatches(
      opdRepositorySource,
      /await\s+db\.\$transaction\(/,
      contractFiles.opdRepository,
      'shared db transaction seam',
    );
  });

  it('fails closed if direct SQL or driver APIs appear in the authoritative auth/OPD repositories', () => {
    for (const repositoryPath of [contractFiles.authRepository, contractFiles.opdRepository]) {
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
