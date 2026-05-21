import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;

const { dbMock, dbState, departmentStore, refreshSessionStore, userStore } = vi.hoisted(() => {
  const departmentStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextDoctorDirectoryLookup: false,
    malformedNextDoctorDirectoryLookup: false,
  };

  const shapeDepartmentRecord = (department: any, select?: any) => {
    const assignedDoctor = department.assignedDoctorUserId
      ? userStore.get(department.assignedDoctorUserId) ?? null
      : null;

    if (!select) {
      return {
        ...department,
        assignedDoctor,
      };
    }

    return {
      ...(select.id ? { id: department.id } : {}),
      ...(select.name ? { name: department.name } : {}),
      ...(select.assignedDoctorUserId ? { assignedDoctorUserId: department.assignedDoctorUserId } : {}),
      ...(select.createdAt ? { createdAt: department.createdAt } : {}),
      ...(select.updatedAt ? { updatedAt: department.updatedAt } : {}),
      ...(select.assignedDoctor
        ? {
            assignedDoctor: assignedDoctor
              ? {
                  ...(select.assignedDoctor.select.id ? { id: assignedDoctor.id } : {}),
                  ...(select.assignedDoctor.select.username
                    ? { username: assignedDoctor.username }
                    : {}),
                  ...(select.assignedDoctor.select.role ? { role: assignedDoctor.role } : {}),
                  ...(select.assignedDoctor.select.isActive
                    ? { isActive: assignedDoctor.isActive }
                    : {}),
                }
              : null,
          }
        : {}),
    };
  };

  const dbMock: any = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.id) {
          return userStore.get(where.id) ?? null;
        }

        return Array.from(userStore.values()).find((user) => user.username === where.username) ?? null;
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
    department: {
      findMany: async ({ where, orderBy, select }: { where?: any; orderBy?: any[]; select?: any }) => {
        if (dbState.failNextDoctorDirectoryLookup) {
          dbState.failNextDoctorDirectoryLookup = false;
          throw new Error('database unavailable');
        }

        if (dbState.malformedNextDoctorDirectoryLookup) {
          dbState.malformedNextDoctorDirectoryLookup = false;
          const malformedDepartment = {
            id: 'department_malformed',
            name: 'Malformed',
            assignedDoctorUserId: 'user_reception_helper',
            createdAt: new Date('2026-05-18T01:00:00.000Z'),
            updatedAt: new Date('2026-05-18T01:00:00.000Z'),
          };

          userStore.set('user_reception_helper', {
            id: 'user_reception_helper',
            username: 'reception-helper',
            passwordHash: 'hashed',
            role: UserRole.RECEPTIONIST,
            isActive: true,
            createdAt: malformedDepartment.createdAt,
            updatedAt: malformedDepartment.updatedAt,
          });

          return [shapeDepartmentRecord(malformedDepartment, select)];
        }

        const departments = Array.from(departmentStore.values())
          .filter((department) => {
            if (where?.assignedDoctorUserId?.not === null) {
              return department.assignedDoctorUserId !== null;
            }

            return true;
          })
          .sort((left, right) => {
            for (const clause of orderBy ?? []) {
              if ('name' in clause) {
                const delta = String(left.name).localeCompare(String(right.name));
                if (delta !== 0) {
                  return clause.name === 'desc' ? -delta : delta;
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

        return departments.map((department) => shapeDepartmentRecord(department, select));
      },
    },
  };

  return { dbMock, dbState, departmentStore, refreshSessionStore, userStore };
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

const seedDepartment = (overrides: Record<string, unknown> = {}) => {
  const id = `department_${departmentStore.size + 1}`;
  const now = new Date('2026-05-15T09:00:00.000Z');
  const record = {
    id,
    name: `Department ${departmentStore.size + 1}`,
    assignedDoctorUserId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  departmentStore.set(record.id, record);
  return record;
};

describe('doctor directory routes', () => {
  beforeEach(() => {
    departmentStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextDoctorDirectoryLookup = false;
    dbState.malformedNextDoctorDirectoryLookup = false;
    vi.restoreAllMocks();
  });

  it('should allow reception staff to read assigned active doctors in deterministic department order', async () => {
    const app = createApp();
    const loggerInfoSpy = vi.spyOn(logger, 'info');
    const accessToken = await loginAs(app, 'reception');
    await loginAs(app, 'doctor');

    const seededDoctor = Array.from(userStore.values()).find((user) => user.username === 'doctor');
    expect(seededDoctor).toBeDefined();
    const bravoDoctor = seedUser({ id: 'user_bravo', username: 'bravo-doctor', role: UserRole.DOCTOR });
    const alphaDoctor = seedUser({ id: 'user_alpha', username: 'alpha-doctor', role: UserRole.DOCTOR });
    seedUser({ id: 'user_inactive', username: 'inactive-doctor', role: UserRole.DOCTOR, isActive: false });

    const cardiology = seedDepartment({ id: 'department_b', name: 'Cardiology', assignedDoctorUserId: alphaDoctor.id });
    const neurology = seedDepartment({ id: 'department_a', name: 'Neurology', assignedDoctorUserId: bravoDoctor.id });
    seedDepartment({ id: 'department_z', name: 'Unassigned', assignedDoctorUserId: null });

    const healthyResponse = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(healthyResponse.status).toBe(200);
    expect(healthyResponse.body).toEqual({
      success: true,
      data: [
        {
          id: alphaDoctor.id,
          username: 'alpha-doctor',
          departmentId: cardiology.id,
          departmentName: 'Cardiology',
        },
        {
          id: bravoDoctor.id,
          username: 'bravo-doctor',
          departmentId: neurology.id,
          departmentName: 'Neurology',
        },
      ],
    });
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.RECEPTIONIST,
        actorUserId: expect.any(String),
        doctorCount: 2,
        doctorIds: [alphaDoctor.id, bravoDoctor.id],
        doctorUsernames: ['alpha-doctor', 'bravo-doctor'],
        departmentIds: [cardiology.id, neurology.id],
        departmentNames: ['Cardiology', 'Neurology'],
      }),
      'opd_doctor_directory_read',
    );
    expect(seededDoctor).toBeDefined();
  });

  it('should also allow admins and return an empty success envelope when no doctors are assigned', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');
    await loginAs(app, 'doctor');
    seedDepartment({ name: 'Cardiology', assignedDoctorUserId: null });

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
