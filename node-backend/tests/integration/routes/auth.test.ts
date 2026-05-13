import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { UserRole } from '@prisma/client';

const { refreshSessionStore, userStore, dbMock } = vi.hoisted(() => {
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();

  const dbMock = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
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

  return { refreshSessionStore, userStore, dbMock };
});

vi.mock('../../../src/infrastructure/database/client.js', () => ({
  db: dbMock,
}));

import { createApp } from '../../../src/app.js';

describe('auth routes', () => {
  beforeEach(() => {
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

  it('should reject invalid credentials', async () => {
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
});
