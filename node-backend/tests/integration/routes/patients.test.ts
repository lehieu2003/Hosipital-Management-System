import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@prisma/client/index';

const { dbMock, dbState, patientStore, refreshSessionStore, userStore } = vi.hoisted(() => {
  const patientStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextPatientCreate: false,
  };

  const dbMock = {
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
      create: async ({ data }: { data: any }) => {
        if (dbState.failNextPatientCreate) {
          dbState.failNextPatientCreate = false;
          throw new Error('database unavailable');
        }

        const id = `patient_${patientStore.size + 1}`;
        const now = new Date();
        const record = {
          id,
          registrationNumber: `REG-${patientStore.size + 1}`,
          createdAt: now,
          updatedAt: now,
          ...data,
        };

        patientStore.set(id, record);
        return record;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return patientStore.get(where.id) ?? null;
      },
    },
  };

  return { dbMock, dbState, patientStore, refreshSessionStore, userStore };
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

describe('patient registration routes', () => {
  beforeEach(() => {
    dbState.failNextPatientCreate = false;
    patientStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
  });

  it('should allow reception staff to register a patient', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Jane Doe',
        primaryPhone: '+1555000111',
        email: 'jane@example.com',
        dateOfBirth: '1990-04-12',
        gender: 'FEMALE',
        address: '123 Main Street',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        fullName: 'Jane Doe',
        primaryPhone: '+1555000111',
        email: 'jane@example.com',
        dateOfBirth: '1990-04-12',
        gender: 'FEMALE',
        address: '123 Main Street',
        registrationNumber: 'REG-1',
      }),
    );

    expect(patientStore.size).toBe(1);
    const [storedPatient] = patientStore.values();
    expect(storedPatient.createdByUserId).toBe('user_2');
  });

  it('should accept the minimum valid payload', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'John Minimum',
        primaryPhone: '555-0100',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBeNull();
    expect(response.body.data.dateOfBirth).toBeNull();
    expect(response.body.data.gender).toBeNull();
    expect(response.body.data.address).toBeNull();
  });

  it('should reject missing bearer tokens through auth middleware', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/patients').send({
      fullName: 'Jane Doe',
      primaryPhone: '+1555000111',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Bearer token is required',
      },
    });
  });

  it('should reject doctor principals with deterministic RBAC denial', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Jane Doe',
        primaryPhone: '+1555000111',
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

  it('should reject malformed patient payloads with validation details', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: '',
        primaryPhone: 12345,
        email: 'not-an-email',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'fullName' }),
        expect.objectContaining({ path: 'primaryPhone' }),
        expect.objectContaining({ path: 'email' }),
      ]),
    );
  });

  it('should map Prisma outages to opd unavailable', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    dbState.failNextPatientCreate = true;

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Jane Doe',
        primaryPhone: '+1555000111',
      });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'OPD_UNAVAILABLE',
        message: 'OPD persistence is temporarily unavailable',
      },
    });
  });

  it('should keep the seeded doctor principal role authoritative for auth', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.role).toBe(UserRole.DOCTOR);
  });
});
