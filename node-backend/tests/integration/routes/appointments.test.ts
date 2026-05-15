import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '@prisma/client';

const { appointmentStore, dbMock, dbState, patientStore, refreshSessionStore, userStore } = vi.hoisted(() => {
  const appointmentStore = new Map<string, any>();
  const patientStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextAppointmentCreate: false,
    failNextAppointmentLookup: false,
    failNextAppointmentUpdate: false,
  };

  const dbMock: any = {
    $transaction: async (callback: (tx: any) => Promise<any>) => callback(dbMock),
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
    patient: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return patientStore.get(where.id) ?? null;
      },
    },
    appointment: {
      create: async ({ data }: { data: any }) => {
        if (dbState.failNextAppointmentCreate) {
          dbState.failNextAppointmentCreate = false;
          throw new Error('database unavailable');
        }

        const id = `appointment_${appointmentStore.size + 1}`;
        const now = new Date();
        const record = {
          id,
          ...data,
          durationMinutes: data.durationMinutes ?? 30,
          notes: data.notes ?? null,
          status: data.status ?? AppointmentStatus.SCHEDULED,
          version: data.version ?? 1,
          createdAt: now,
          updatedAt: now,
        };

        appointmentStore.set(id, record);
        return record;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (dbState.failNextAppointmentLookup) {
          dbState.failNextAppointmentLookup = false;
          throw new Error('database unavailable');
        }

        return appointmentStore.get(where.id) ?? null;
      },
      updateMany: async ({ where, data }: { where: { id: string; version: number }; data: any }) => {
        if (dbState.failNextAppointmentUpdate) {
          dbState.failNextAppointmentUpdate = false;
          throw new Error('database unavailable');
        }

        const current = appointmentStore.get(where.id);
        if (!current || current.version !== where.version) {
          return { count: 0 };
        }

        const nextVersion = current.version + (data.version?.increment ?? 0);
        const updatedRecord = {
          ...current,
          ...(data.doctorUserId !== undefined ? { doctorUserId: data.doctorUserId } : {}),
          ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
          ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          version: nextVersion,
          updatedAt: new Date(),
        };

        appointmentStore.set(where.id, updatedRecord);
        return { count: 1 };
      },
    },
  };

  return { appointmentStore, dbMock, dbState, patientStore, refreshSessionStore, userStore };
});

vi.mock('../../../src/infrastructure/database/client.js', () => ({
  db: dbMock,
}));

import { createApp } from '../../../src/app.js';

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

const seedPatient = (overrides: Record<string, unknown> = {}) => {
  const id = `patient_${patientStore.size + 1}`;
  const now = new Date('2026-05-15T08:00:00.000Z');
  const record = {
    id,
    registrationNumber: `REG-${patientStore.size + 1}`,
    fullName: 'Jane Doe',
    primaryPhone: '+1555000111',
    email: 'jane@example.com',
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
  const now = new Date('2026-05-15T08:30:00.000Z');
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

describe('appointment scheduling routes', () => {
  beforeEach(() => {
    appointmentStore.clear();
    patientStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextAppointmentCreate = false;
    dbState.failNextAppointmentLookup = false;
    dbState.failNextAppointmentUpdate = false;
  });

  it('should allow reception staff to create appointments with deterministic defaults', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const doctor = findUserByUsername('doctor');
    const patient = seedPatient();

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patient.id,
        doctorUserId: doctor.id,
        scheduledAt: '2026-05-15T09:30:00.000Z',
        notes: 'Initial visit',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        patientId: patient.id,
        doctorUserId: doctor.id,
        scheduledAt: '2026-05-15T09:30:00.000Z',
        durationMinutes: 30,
        status: AppointmentStatus.SCHEDULED,
        notes: 'Initial visit',
        version: 1,
      }),
    );
  });

  it('should reject scheduling targets that exist but are not doctors', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();
    const adminToken = await loginAs(app, 'admin');
    expect(adminToken).toBeTypeOf('string');
    const admin = findUserByUsername('admin');

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patient.id,
        doctorUserId: admin.id,
        scheduledAt: '2026-05-15T09:30:00.000Z',
      });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'SCHEDULING_TARGET_NOT_DOCTOR',
        message: 'Scheduling target must be an active doctor principal',
      },
    });
  });

  it('should return not found for missing patient or doctor references', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const doctor = findUserByUsername('doctor');

    const missingPatientResponse = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: 'missing-patient',
        doctorUserId: doctor.id,
        scheduledAt: '2026-05-15T09:30:00.000Z',
      });

    expect(missingPatientResponse.status).toBe(404);
    expect(missingPatientResponse.body.error.code).toBe('PATIENT_NOT_FOUND');

    const patient = seedPatient();
    const missingDoctorResponse = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patient.id,
        doctorUserId: 'missing-doctor',
        scheduledAt: '2026-05-15T09:30:00.000Z',
      });

    expect(missingDoctorResponse.status).toBe(404);
    expect(missingDoctorResponse.body.error.code).toBe('DOCTOR_NOT_FOUND');
  });

  it('should reject malformed create and update payloads with validation details', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    const createResponse = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: '',
        doctorUserId: '',
      });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(createResponse.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'patientId' }),
        expect.objectContaining({ path: 'doctorUserId' }),
        expect.objectContaining({ path: 'scheduledAt' }),
      ]),
    );

    const updateResponse = await request(app)
      .patch('/api/v1/appointments/appointment_999')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: '1',
        status: 'BOOKED',
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(updateResponse.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'version' }),
        expect.objectContaining({ path: 'status' }),
      ]),
    );
  });

  it('should reject doctor principals through RBAC before reaching appointment routes', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: 'patient_1',
        doctorUserId: 'user_1',
        scheduledAt: '2026-05-15T09:30:00.000Z',
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Role is not permitted for this resource',
      },
    });
  });

  it('should update appointments with version guards and reject stale writes', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();
    const existing = seedAppointment({ patientId: patient.id, doctorUserId: findUserByUsername('doctor').id });

    const firstUpdate = await request(app)
      .patch(`/api/v1/appointments/${existing.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: 1,
        status: 'CHECKED_IN',
        notes: 'Arrived early',
      });

    expect(firstUpdate.status).toBe(200);
    expect(firstUpdate.body.data.status).toBe(AppointmentStatus.CHECKED_IN);
    expect(firstUpdate.body.data.notes).toBe('Arrived early');
    expect(firstUpdate.body.data.version).toBe(2);

    const staleUpdate = await request(app)
      .patch(`/api/v1/appointments/${existing.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: 1,
        status: 'COMPLETED',
      });

    expect(staleUpdate.status).toBe(409);
    expect(staleUpdate.body).toEqual({
      success: false,
      error: {
        code: 'APPOINTMENT_VERSION_CONFLICT',
        message: 'Appointment version conflict',
      },
    });
  });

  it('should return appointment not found for missing updates', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');

    const response = await request(app)
      .patch('/api/v1/appointments/missing-appointment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: 1,
        status: 'CANCELLED',
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found',
      },
    });
  });

  it('should map appointment store failures to opd unavailable on create and update', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const doctor = findUserByUsername('doctor');
    const patient = seedPatient();

    dbState.failNextAppointmentCreate = true;
    const createResponse = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patient.id,
        doctorUserId: doctor.id,
        scheduledAt: '2026-05-15T09:30:00.000Z',
      });

    expect(createResponse.status).toBe(503);
    expect(createResponse.body.error.code).toBe('OPD_UNAVAILABLE');

    const existing = seedAppointment({ patientId: patient.id, doctorUserId: doctor.id });
    dbState.failNextAppointmentUpdate = true;
    const updateResponse = await request(app)
      .patch(`/api/v1/appointments/${existing.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: existing.version,
        status: 'CANCELLED',
      });

    expect(updateResponse.status).toBe(503);
    expect(updateResponse.body.error.code).toBe('OPD_UNAVAILABLE');
  });
});
