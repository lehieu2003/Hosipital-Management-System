import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;

const { dbMock, dbState, refreshSessionStore, userStore } = vi.hoisted(() => {
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextUserLookup: false,
  };

  const dbMock = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        if (dbState.failNextUserLookup) {
          dbState.failNextUserLookup = false;
          throw new Error('database unavailable');
        }

        if (where.id) {
          return userStore.get(where.id) ?? null;
        }

        return (
          Array.from(userStore.values()).find((user) => user.username === where.username) ?? null
        );
      },
      create: async ({ data }: { data: any }) => {
        const id = `user_${userStore.size + 1}`;
        const record = {
          id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        userStore.set(id, record);
        return record;
      },
    },
    refreshSession: {
      create: async ({ data }: { data: any }) => {
        const id = `refresh_${refreshSessionStore.size + 1}`;
        const record = {
          id,
          revokedAt: null,
          revokeReason: null,
          replacedByJti: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        refreshSessionStore.set(record.tokenJti, record);
        return record;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { tokenJti: string };
        include?: { user: boolean };
      }) => {
        const record = refreshSessionStore.get(where.tokenJti);
        if (!record) {
          return null;
        }

        if (!include?.user) {
          return record;
        }

        return {
          ...record,
          user: userStore.get(record.userId),
        };
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        let count = 0;

        for (const [tokenJti, record] of refreshSessionStore.entries()) {
          const matchesToken = where.tokenJti ? where.tokenJti === tokenJti : true;
          const matchesUser = where.userId ? where.userId === record.userId : true;
          const matchesRevoked = where.revokedAt === null ? record.revokedAt === null : true;

          if (matchesToken && matchesUser && matchesRevoked) {
            refreshSessionStore.set(tokenJti, {
              ...record,
              ...data,
            });
            count += 1;
          }
        }

        return { count };
      },
    },
  };

  return { dbMock, dbState, refreshSessionStore, userStore };
});

vi.mock('../../../src/infrastructure/database/client.js', () => ({
  db: dbMock,
}));

import { createApp } from '../../../src/app.js';
import {
  redactHeaders,
  serializeRequestForLogs,
  serializeResponseForLogs,
} from '../../../src/shared/utils/logger.js';

describe('auth routes', () => {
  beforeEach(() => {
    dbState.failNextUserLookup = false;
    refreshSessionStore.clear();
    userStore.clear();
  });

  it('should login, resolve me, refresh, and revoke replayed refresh token', async () => {
    const app = createApp();

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      username: 'doctor',
      password: 'secret123',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.user.role).toBe(UserRole.DOCTOR);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(loginResponse.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(loginResponse.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');

    const loginCookie = loginResponse.headers['set-cookie'][0];
    const accessToken = loginResponse.body.data.accessToken as string;

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.username).toBe('doctor');

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookie);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.success).toBe(true);
    expect(refreshResponse.body.data.accessToken).toBeTypeOf('string');
    expect(refreshResponse.headers['set-cookie']).toBeDefined();
    expect(refreshResponse.headers['set-cookie'][0]).not.toBe(loginCookie);

    const replayResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookie);

    expect(replayResponse.status).toBe(401);
    expect(replayResponse.body).toEqual({
      success: false,
      error: {
        code: 'REVOKED_REFRESH_TOKEN',
        message: 'Refresh token revoked',
      },
    });
  });

  it('should reject invalid credentials with deterministic envelope', async () => {
    const app = createApp();

    await request(app).post('/api/v1/auth/login').send({
      username: 'doctor',
      password: 'secret123',
    });

    const invalidResponse = await request(app).post('/api/v1/auth/login').send({
      username: 'doctor',
      password: 'wrong-password',
    });

    expect(invalidResponse.status).toBe(401);
    expect(invalidResponse.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      },
    });
  });

  it('should reject malformed login payloads with validation details', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/auth/login').send({
      username: '',
      password: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid request body');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'username' }),
        expect.objectContaining({ path: 'password' }),
      ]),
    );
  });

  it('should reject refresh when the cookie is missing', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      },
    });
  });

  it('should return auth unavailable when the auth store lookup fails', async () => {
    const app = createApp();
    dbState.failNextUserLookup = true;

    const response = await request(app).post('/api/v1/auth/login').send({
      username: 'doctor',
      password: 'secret123',
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication temporarily unavailable',
      },
    });
  });

  it('should redact bearer and refresh cookies in structured log serializers', () => {
    const authorization = 'Bearer access-token-value';
    const refreshCookie = 'refresh_token=refresh-token-value';

    const serializedRequest = serializeRequestForLogs({
      headers: {
        authorization,
        cookie: refreshCookie,
        host: 'localhost:3000',
      },
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1', remotePort: 3000 },
      url: '/api/v1/auth/refresh',
    } as any);

    const response = {
      getHeaders: () => ({
        'content-type': 'application/json',
        'set-cookie': [refreshCookie],
      }),
      headersSent: true,
      statusCode: 200,
    } as any;

    const serializedResponse = serializeResponseForLogs(response);

    expect(redactHeaders({ authorization, cookie: refreshCookie, 'set-cookie': [refreshCookie] })).toEqual({
      authorization: '[redacted]',
      cookie: '[redacted]',
      'set-cookie': '[redacted]',
    });
    expect(serializedRequest).toBeDefined();
    expect(serializedResponse).toBeDefined();
    expect(serializedRequest!.headers?.authorization).toBe('[redacted]');
    expect(serializedRequest!.headers?.cookie).toBe('[redacted]');
    expect((serializedResponse!.headers as Record<string, unknown>)['set-cookie']).toBe('[redacted]');
    expect(JSON.stringify(serializedRequest)).not.toContain(authorization);
    expect(JSON.stringify(serializedRequest)).not.toContain(refreshCookie);
    expect(JSON.stringify(serializedResponse)).not.toContain(refreshCookie);
  });
});
