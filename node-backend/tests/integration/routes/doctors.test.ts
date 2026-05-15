import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@prisma/client';

const { dbMock, dbState, refreshSessionStore, userStore } = vi.hoisted(() => {
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextDoctorDirectoryLookup: false,
    malformedNextDoctorDirectoryLookup: false,
  };

  const dbMock: any = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.id) {
          return userStore.get(where.id) ?? null;
        }

        return Array.from(userStore.values()).find((user) => user.username === where.username) ?? null;
      },
      findMany: async ({ where, orderBy, select }: { where?: any; orderBy?: any[]; select?: any }) => {
        if (dbState.failNextDoctorDirectoryLookup) {
          dbState.failNextDoctorDirectoryLookup = false;
          throw new Error('database unavailable');
        }

        if (dbState.malformedNextDoctorDirectoryLookup) {
          dbState.malformedNextDoctorDirectoryLookup = false;
          return [
            {
              id: 'malformed-user',
              username: 'not-a-doctor',
              role: UserRole.RECEPTIONIST,
              isActive: true,
            },
          ];
        }

        const doctors = Array.from(userStore.values())
          .filter((user) => (where?.role ? user.role === where.role : true))
          .filter((user) => (where?.isActive !== undefined ? user.isActive === where.isActive : true))
          .sort((left, right) => {
            for (const clause of orderBy ?? []) {
              if ('username' in clause) {
                const delta = String(left.username).localeCompare(String(right.username));
                if (delta !== 0) {
                  return clause.username === 'desc' ? -delta : delta;
                }
              }

              if ('id' in clause) {
                const delta = String(left.id).localeCompare(String(right.id));
                if (delta !== 0) {
                  return clause.id === 'desc' ? -delta : delta;
                }
              }
            }

            return 0;
          });

        if (!select) {
          return doctors;
        }

        return doctors.map((doctor) => ({
          ...(select.id ? { id: doctor.id } : {}),
          ...(select.username ? { username: doctor.username } : {}),
          ...(select.role ? { role: doctor.role } : {}),
          ...(select.isActive ? { isActive: doctor.isActive } : {}),
        }));
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
      findUnique: async ({ where, include }: { where: { tokenJti: string }; include?: { user: boolean } }) => {
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
import { logger } from '../../../src/shared/utils/logger.js';

const loginAs = async (app: ReturnType<typeof createApp>, username: string) => {
  const response = await request(app).post('/api/v1/auth/login').send({
    username,
    password: 'secret123',
  });

  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
};

const seedUser = (overrides: Record<string, unknown> = {}) => {
  const id = `user_${userStore.size + 1}`;
  const now = new Date('2026-05-15T08:00:00.000Z');
  const record = {
    id,
    username: `seed-user-${userStore.size + 1}`,
    passwordHash: 'hashed',
    role: UserRole.DOCTOR,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  userStore.set(record.id, record);
  return record;
};

describe('doctor directory routes', () => {
  beforeEach(() => {
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextDoctorDirectoryLookup = false;
    dbState.malformedNextDoctorDirectoryLookup = false;
    vi.restoreAllMocks();
  });

  it('should allow reception staff to read active doctor principals in deterministic order', async () => {
    const app = createApp();
    const loggerInfoSpy = vi.spyOn(logger, 'info');
    const accessToken = await loginAs(app, 'reception');

    const bravoDoctor = seedUser({ id: 'user_bravo', username: 'bravo-doctor', role: UserRole.DOCTOR, isActive: true });
    const alphaDoctorLaterId = seedUser({ id: 'user_z', username: 'alpha-doctor', role: UserRole.DOCTOR, isActive: true });
    const alphaDoctorEarlierId = seedUser({ id: 'user_a', username: 'alpha-doctor', role: UserRole.DOCTOR, isActive: true });
    const seededDoctor = Array.from(userStore.values()).find((user) => user.username === 'doctor');
    expect(seededDoctor).toBeDefined();

    seedUser({ username: 'inactive-doctor', role: UserRole.DOCTOR, isActive: false });
    seedUser({ username: 'reception-helper', role: UserRole.RECEPTIONIST, isActive: true });

    const response = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        { id: alphaDoctorEarlierId.id, username: 'alpha-doctor' },
        { id: alphaDoctorLaterId.id, username: 'alpha-doctor' },
        { id: bravoDoctor.id, username: 'bravo-doctor' },
        { id: seededDoctor!.id, username: 'doctor' },
      ],
    });
    expect(
      response.body.data.every((doctor: any) => Object.keys(doctor).sort().join(',') === 'id,username'),
    ).toBe(true);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.RECEPTIONIST,
        actorUserId: expect.any(String),
        doctorCount: 4,
        doctorIds: [alphaDoctorEarlierId.id, alphaDoctorLaterId.id, bravoDoctor.id, seededDoctor!.id],
        doctorUsernames: ['alpha-doctor', 'alpha-doctor', 'bravo-doctor', 'doctor'],
      }),
      'opd_doctor_directory_read',
    );
  });

  it('should also allow admins and return an empty success envelope when no doctors are active', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');
    const seededDoctor = Array.from(userStore.values()).find((user) => user.username === 'doctor');
    expect(seededDoctor).toBeDefined();
    seededDoctor!.isActive = false;
    userStore.set(seededDoctor!.id, seededDoctor);
    seedUser({ username: 'doctor-disabled', role: UserRole.DOCTOR, isActive: false });
    seedUser({ username: 'non-doctor', role: UserRole.ADMIN, isActive: true });

    const response = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
    });
  });

  it('should reject missing, invalid, and wrong-role callers', async () => {
    const app = createApp();

    const missingTokenResponse = await request(app).get('/api/v1/doctors');
    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Bearer token is required',
      },
    });

    const invalidTokenResponse = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', 'Bearer definitely-not-a-valid-token');
    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
      },
    });

    const doctorToken = await loginAs(app, 'doctor');
    const forbiddenResponse = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Role is not permitted for this resource',
      },
    });
  });

  it('should fail closed with OPD_UNAVAILABLE on lookup failures', async () => {
    const app = createApp();
    const loggerErrorSpy = vi.spyOn(logger, 'error');
    const accessToken = await loginAs(app, 'reception');

    dbState.failNextDoctorDirectoryLookup = true;

    const response = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'OPD_UNAVAILABLE',
        message: 'OPD persistence is temporarily unavailable',
      },
    });
    expect(response.body.data).toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.RECEPTIONIST,
        actorUserId: expect.any(String),
        errorCode: 'OPD_UNAVAILABLE',
      }),
      'opd_doctor_directory_read_failed',
    );
  });

  it('should treat malformed doctor directory payloads as OPD_UNAVAILABLE', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    dbState.malformedNextDoctorDirectoryLookup = true;

    const response = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'OPD_UNAVAILABLE',
        message: 'OPD persistence is temporarily unavailable',
      },
    });
  });
});
