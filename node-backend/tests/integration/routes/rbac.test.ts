import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@prisma/client/index';

const { dbMock, dbState, userStore } = vi.hoisted(() => {
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
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return { dbMock, dbState, userStore };
});

vi.mock('../../../src/infrastructure/database/client.js', () => ({
  db: dbMock,
}));

import { createApp } from '../../../src/app.js';
import { buildAccessToken } from '../../../src/shared/helpers/jwt.helper.js';
import { logger } from '../../../src/shared/utils/logger.js';

type TestUser = {
  id: string;
  username: string;
  role: string;
  isActive?: boolean;
};

const seedUser = ({ id, username, role, isActive = true }: TestUser) => {
  const record = {
    id,
    username,
    role,
    isActive,
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  userStore.set(id, record);
  return record;
};

const issueAccessToken = (user: { id: string; username: string }, role: string) => {
  return buildAccessToken({
    sub: user.id,
    role,
    username: user.username,
  });
};

describe('rbac probe routes', () => {
  beforeEach(() => {
    dbState.failNextUserLookup = false;
    userStore.clear();
    vi.restoreAllMocks();
  });

  it.each([
    { route: 'admin', path: '/api/v1/probe/admin', userRole: UserRole.ADMIN, expectedStatus: 200 },
    {
      route: 'receptionist',
      path: '/api/v1/probe/receptionist',
      userRole: UserRole.RECEPTIONIST,
      expectedStatus: 200,
    },
    { route: 'doctor', path: '/api/v1/probe/doctor', userRole: UserRole.DOCTOR, expectedStatus: 200 },
    { route: 'admin', path: '/api/v1/probe/admin', userRole: UserRole.DOCTOR, expectedStatus: 403 },
    {
      route: 'receptionist',
      path: '/api/v1/probe/receptionist',
      userRole: UserRole.ADMIN,
      expectedStatus: 403,
    },
    {
      route: 'doctor',
      path: '/api/v1/probe/doctor',
      userRole: UserRole.RECEPTIONIST,
      expectedStatus: 403,
    },
  ])('enforces the role policy for $path as $userRole', async ({ path, route, userRole, expectedStatus }) => {
    const app = createApp();
    const user = seedUser({
      id: `user_${route}_${userRole}`,
      username: `${route}_${userRole.toLowerCase()}`,
      role: userRole,
    });

    const response = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${issueAccessToken(user, userRole)}`);

    expect(response.status).toBe(expectedStatus);

    if (expectedStatus === 200) {
      expect(response.body).toEqual({
        success: true,
        data: {
          route,
          requiredRoles: [userRole],
          principal: {
            userId: user.id,
            username: user.username,
            role: userRole,
          },
        },
      });
      return;
    }

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Role is not permitted for this resource',
      },
    });
  });

  it('uses the database role instead of the JWT role claim for authorization', async () => {
    const app = createApp();
    const warnSpy = vi.spyOn(logger, 'warn');
    const user = seedUser({
      id: 'doctor_claim_override',
      username: 'doctor_claim_override',
      role: UserRole.DOCTOR,
    });
    const forgedAdminClaimToken = issueAccessToken(user, UserRole.ADMIN);

    const deniedAdminResponse = await request(app)
      .get('/api/v1/probe/admin')
      .set('Authorization', `Bearer ${forgedAdminClaimToken}`);

    expect(deniedAdminResponse.status).toBe(403);
    expect(deniedAdminResponse.body.error.code).toBe('FORBIDDEN');

    const allowedDoctorResponse = await request(app)
      .get('/api/v1/probe/doctor')
      .set('Authorization', `Bearer ${forgedAdminClaimToken}`);

    expect(allowedDoctorResponse.status).toBe(200);
    expect(allowedDoctorResponse.body.data.principal.role).toBe(UserRole.DOCTOR);
    expect(
      warnSpy.mock.calls.some(
        ([payload, message]) =>
          message === 'auth_role_claim_ignored' &&
          (payload as Record<string, unknown>).tokenRole === UserRole.ADMIN &&
          (payload as Record<string, unknown>).dbRole === UserRole.DOCTOR,
      ),
    ).toBe(true);
  });

  it('denies a protected route when no RBAC policy is configured and emits a policy_missing signal', async () => {
    const app = createApp();
    const warnSpy = vi.spyOn(logger, 'warn');
    const user = seedUser({
      id: 'admin_unscoped',
      username: 'admin_unscoped',
      role: UserRole.ADMIN,
    });

    const response = await request(app)
      .get('/api/v1/probe/unscoped')
      .set('Authorization', `Bearer ${issueAccessToken(user, UserRole.ADMIN)}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access policy not configured',
      },
    });
    expect(
      warnSpy.mock.calls.some(
        ([payload, message]) =>
          message === 'rbac_access_denied' &&
          (payload as Record<string, unknown>).reason === 'policy_missing',
      ),
    ).toBe(true);
  });

  it('rejects missing and malformed bearer tokens with deterministic auth envelopes', async () => {
    const app = createApp();

    const missingTokenResponse = await request(app).get('/api/v1/probe/admin');
    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Bearer token is required',
      },
    });

    const invalidTokenResponse = await request(app)
      .get('/api/v1/probe/admin')
      .set('Authorization', 'Bearer definitely-not-a-jwt');

    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
      },
    });
  });

  it('denies unknown roles and emits an unknown_role signal', async () => {
    const app = createApp();
    const warnSpy = vi.spyOn(logger, 'warn');
    const user = seedUser({
      id: 'user_unknown_role',
      username: 'user_unknown_role',
      role: 'JANITOR',
    });

    const response = await request(app)
      .get('/api/v1/probe/doctor')
      .set('Authorization', `Bearer ${issueAccessToken(user, 'JANITOR')}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Role is not permitted for this resource',
      },
    });
    expect(
      warnSpy.mock.calls.some(
        ([payload, message]) =>
          message === 'rbac_access_denied' &&
          (payload as Record<string, unknown>).reason === 'unknown_role',
      ),
    ).toBe(true);
  });

  it('returns AUTH_UNAVAILABLE when principal resolution cannot reach the auth store', async () => {
    const app = createApp();
    const user = seedUser({
      id: 'user_auth_unavailable',
      username: 'user_auth_unavailable',
      role: UserRole.ADMIN,
    });
    dbState.failNextUserLookup = true;

    const response = await request(app)
      .get('/api/v1/probe/admin')
      .set('Authorization', `Bearer ${issueAccessToken(user, UserRole.ADMIN)}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication temporarily unavailable',
      },
    });
  });

  it('emits an allow signal when a principal satisfies the route policy', async () => {
    const app = createApp();
    const infoSpy = vi.spyOn(logger, 'info');
    const user = seedUser({
      id: 'admin_allow_signal',
      username: 'admin_allow_signal',
      role: UserRole.ADMIN,
    });

    const response = await request(app)
      .get('/api/v1/probe/admin')
      .set('Authorization', `Bearer ${issueAccessToken(user, UserRole.ADMIN)}`);

    expect(response.status).toBe(200);
    expect(
      infoSpy.mock.calls.some(
        ([payload, message]) =>
          message === 'rbac_access_allowed' &&
          (payload as Record<string, unknown>).endpoint === '/api/v1/probe/admin' &&
          (payload as Record<string, unknown>).role === UserRole.ADMIN,
      ),
    ).toBe(true);
  });
});
