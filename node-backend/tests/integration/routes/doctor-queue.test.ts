import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '@prisma/client';

const { appointmentStore, dbMock, dbState, patientStore, refreshSessionStore, userStore } = vi.hoisted(() => {
  const appointmentStore = new Map<string, any>();
  const patientStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextAppointmentLookup: false,
    malformedNextQueueLookup: false,
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
    appointment: {
      findMany: async ({ where, include }: { where: any; include?: { patient: boolean } }) => {
        if (dbState.failNextAppointmentLookup) {
          dbState.failNextAppointmentLookup = false;
          throw new Error('database unavailable');
        }

        if (dbState.malformedNextQueueLookup) {
          dbState.malformedNextQueueLookup = false;
          return null;
        }

        const filtered = Array.from(appointmentStore.values())
          .filter((appointment) => appointment.doctorUserId === where.doctorUserId)
          .filter((appointment) => where.status?.in?.includes(appointment.status) ?? true)
          .sort((left, right) => {
            const scheduledAtDelta = left.scheduledAt.getTime() - right.scheduledAt.getTime();
            if (scheduledAtDelta !== 0) {
              return scheduledAtDelta;
            }

            const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
            if (createdAtDelta !== 0) {
              return createdAtDelta;
            }

            return String(left.id).localeCompare(String(right.id));
          });

        if (!include?.patient) {
          return filtered;
        }

        return filtered.map((appointment) => ({
          ...appointment,
          patient: patientStore.get(appointment.patientId),
        }));
      },
    },
  };

  return { appointmentStore, dbMock, dbState, patientStore, refreshSessionStore, userStore };
});

vi.mock('../../../src/infrastructure/database/client.js', () => ({
  db: dbMock,
}));

import { createApp } from '../../../src/app.js';
import { buildAccessToken } from '../../../src/shared/helpers/jwt.helper.js';
import { logger } from '../../../src/shared/utils/logger.js';

const loginAs = async (app: ReturnType<typeof createApp>, username: string) => {
  const response = await request(app).post('/api/v1/auth/login').send({
    username,
    password: 'secret123',
  });

  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
};

const findUserByUsername = (username: string) =>
  Array.from(userStore.values()).find((user) => user.username === username);

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

  userStore.set(id, record);
  return record;
};

const seedPatient = (overrides: Record<string, unknown> = {}) => {
  const id = `patient_${patientStore.size + 1}`;
  const now = new Date('2026-05-15T08:00:00.000Z');
  const record = {
    id,
    registrationNumber: `REG-${patientStore.size + 1}`,
    fullName: `Patient ${patientStore.size + 1}`,
    primaryPhone: `+1555000${patientStore.size + 1}`,
    email: `patient${patientStore.size + 1}@example.com`,
    dateOfBirth: new Date('1990-04-12T00:00:00.000Z'),
    gender: 'FEMALE',
    address: '123 Main Street',
    createdByUserId: 'user_seed',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  patientStore.set(id, record);
  return record;
};

const seedAppointment = (overrides: Record<string, unknown> = {}) => {
  const id = `appointment_${appointmentStore.size + 1}`;
  const now = new Date(`2026-05-15T08:${30 + appointmentStore.size}:00.000Z`);
  const record = {
    id,
    patientId: 'patient_1',
    doctorUserId: 'user_1',
    scheduledAt: new Date('2026-05-15T09:30:00.000Z'),
    durationMinutes: 30,
    status: AppointmentStatus.SCHEDULED,
    notes: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  appointmentStore.set(id, record);
  return record;
};

describe('doctor queue routes', () => {
  beforeEach(() => {
    appointmentStore.clear();
    patientStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextAppointmentLookup = false;
    dbState.malformedNextQueueLookup = false;
    vi.restoreAllMocks();
  });

  it('should return only the authenticated doctor active queue in deterministic order', async () => {
    const app = createApp();
    const loggerInfoSpy = vi.spyOn(logger, 'info');
    const accessToken = await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    const otherDoctor = seedUser({ username: 'doctor-other', role: UserRole.DOCTOR });

    const patientOne = seedPatient({ fullName: 'Alice Queue' });
    const patientTwo = seedPatient({ fullName: 'Bob Queue' });
    const patientThree = seedPatient({ fullName: 'Cara Queue' });
    const patientFour = seedPatient({ fullName: 'Dana Queue' });
    const patientFive = seedPatient({ fullName: 'Eli Queue' });
    const patientSix = seedPatient({ fullName: 'Finn Queue' });

    const laterSlot = seedAppointment({
      patientId: patientOne.id,
      doctorUserId: doctor.id,
      scheduledAt: new Date('2026-05-15T10:00:00.000Z'),
      createdAt: new Date('2026-05-15T08:34:00.000Z'),
    });
    const sameTimeLaterCreated = seedAppointment({
      patientId: patientTwo.id,
      doctorUserId: doctor.id,
      scheduledAt: new Date('2026-05-15T09:00:00.000Z'),
      createdAt: new Date('2026-05-15T08:33:00.000Z'),
      status: AppointmentStatus.CHECKED_IN,
    });
    const sameTimeEarlierCreated = seedAppointment({
      patientId: patientThree.id,
      doctorUserId: doctor.id,
      scheduledAt: new Date('2026-05-15T09:00:00.000Z'),
      createdAt: new Date('2026-05-15T08:31:00.000Z'),
    });

    const completed = seedAppointment({
      patientId: patientFour.id,
      doctorUserId: doctor.id,
      status: AppointmentStatus.COMPLETED,
      scheduledAt: new Date('2026-05-15T11:00:00.000Z'),
    });
    const cancelled = seedAppointment({
      patientId: patientFive.id,
      doctorUserId: doctor.id,
      status: AppointmentStatus.CANCELLED,
      scheduledAt: new Date('2026-05-15T11:30:00.000Z'),
    });
    const otherDoctorAppointment = seedAppointment({
      patientId: patientSix.id,
      doctorUserId: otherDoctor.id,
      scheduledAt: new Date('2026-05-15T08:45:00.000Z'),
    });

    const response = await request(app)
      .get('/api/v1/doctor/queue')
      .query({ doctorUserId: otherDoctor.id })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.map((item: any) => item.id)).toEqual([
      sameTimeEarlierCreated.id,
      sameTimeLaterCreated.id,
      laterSlot.id,
    ]);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sameTimeEarlierCreated.id,
          doctorUserId: doctor.id,
          patient: expect.objectContaining({
            id: patientThree.id,
            fullName: 'Cara Queue',
            registrationNumber: patientThree.registrationNumber,
          }),
        }),
      ]),
    );
    expect(response.body.data.map((item: any) => item.id)).not.toContain(completed.id);
    expect(response.body.data.map((item: any) => item.id)).not.toContain(cancelled.id);
    expect(response.body.data.map((item: any) => item.id)).not.toContain(otherDoctorAppointment.id);
    expect(response.body.data.every((item: any) => !('notes' in item))).toBe(true);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.DOCTOR,
        actorUserId: doctor.id,
        queueCount: 3,
        appointmentIds: [sameTimeEarlierCreated.id, sameTimeLaterCreated.id, laterSlot.id],
        patientIds: [patientThree.id, patientTwo.id, patientOne.id],
      }),
      'opd_doctor_queue_read',
    );
  });

  it('should return an empty queue with a success envelope', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const response = await request(app)
      .get('/api/v1/doctor/queue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
    });
  });

  it('should reject missing and invalid bearer tokens', async () => {
    const app = createApp();

    const missingTokenResponse = await request(app).get('/api/v1/doctor/queue');

    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Bearer token is required',
      },
    });

    const invalidTokenResponse = await request(app)
      .get('/api/v1/doctor/queue')
      .set('Authorization', 'Bearer definitely-not-a-valid-token');

    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
      },
    });
  });

  it('should reject non-doctor principals through RBAC before queue reads', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    const response = await request(app)
      .get('/api/v1/doctor/queue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Role is not permitted for this resource',
      },
    });
  });

  it('should ignore forged role claims and trust the DB-resolved doctor principal', async () => {
    const app = createApp();
    const loggerWarnSpy = vi.spyOn(logger, 'warn');
    await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    const patient = seedPatient({ fullName: 'Forged Claim Patient' });
    const queueItem = seedAppointment({
      patientId: patient.id,
      doctorUserId: doctor.id,
      scheduledAt: new Date('2026-05-15T09:15:00.000Z'),
    });

    const forgedAccessToken = buildAccessToken({
      sub: doctor.id,
      role: UserRole.ADMIN,
      username: doctor.username,
    });

    const response = await request(app)
      .get('/api/v1/doctor/queue')
      .set('Authorization', `Bearer ${forgedAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: queueItem.id,
        doctorUserId: doctor.id,
      }),
    ]);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dbRole: UserRole.DOCTOR,
        tokenRole: UserRole.ADMIN,
        userId: doctor.id,
      }),
      'auth_role_claim_ignored',
    );
  });

  it('should fail closed with OPD_UNAVAILABLE when queue lookup fails', async () => {
    const app = createApp();
    const loggerErrorSpy = vi.spyOn(logger, 'error');
    const accessToken = await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    const patient = seedPatient({ fullName: 'Unavailable Queue Patient' });
    seedAppointment({
      patientId: patient.id,
      doctorUserId: doctor.id,
      scheduledAt: new Date('2026-05-15T09:45:00.000Z'),
    });

    dbState.failNextAppointmentLookup = true;

    const response = await request(app)
      .get('/api/v1/doctor/queue')
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
        actorRole: UserRole.DOCTOR,
        actorUserId: doctor.id,
        errorCode: 'OPD_UNAVAILABLE',
      }),
      'opd_doctor_queue_read_failed',
    );
  });

  it('should treat malformed queue payloads as OPD_UNAVAILABLE failures', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    dbState.malformedNextQueueLookup = true;

    const response = await request(app)
      .get('/api/v1/doctor/queue')
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
