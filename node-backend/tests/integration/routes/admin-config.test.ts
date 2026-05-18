import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@prisma/client';

const { dbMock, dbState, departmentStore, refreshSessionStore, userStore } = vi.hoisted(() => {
  const departmentStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextDepartmentCreate: false,
    failNextDepartmentList: false,
    failNextDepartmentAssign: false,
    malformedNextDepartmentList: false,
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

  const sortDepartments = (departments: any[], orderBy?: Array<Record<string, 'asc' | 'desc'>>) => {
    return [...departments].sort((left, right) => {
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
    department: {
      create: async ({ data, select }: { data: any; select?: any }) => {
        if (dbState.failNextDepartmentCreate) {
          dbState.failNextDepartmentCreate = false;
          throw new Error('database unavailable');
        }

        const id = `department_${departmentStore.size + 1}`;
        const now = new Date();
        const record = {
          id,
          assignedDoctorUserId: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };

        departmentStore.set(id, record);
        return shapeDepartmentRecord(record, select);
      },
      findUnique: async ({ where, select }: { where: { id?: string; name?: string }; select?: any }) => {
        const record = where.id
          ? departmentStore.get(where.id) ?? null
          : Array.from(departmentStore.values()).find((department) => department.name === where.name) ?? null;

        return record ? shapeDepartmentRecord(record, select) : null;
      },
      findMany: async ({ where, orderBy, select }: { where?: any; orderBy?: any[]; select?: any }) => {
        if (dbState.failNextDepartmentList) {
          dbState.failNextDepartmentList = false;
          throw new Error('database unavailable');
        }

        if (dbState.malformedNextDepartmentList) {
          dbState.malformedNextDepartmentList = false;
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

        const departments = Array.from(departmentStore.values()).filter((department) => {
          if (where?.assignedDoctorUserId?.not === null) {
            return department.assignedDoctorUserId !== null;
          }

          return true;
        });

        return sortDepartments(departments, orderBy).map((department) => shapeDepartmentRecord(department, select));
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        if (dbState.failNextDepartmentAssign) {
          dbState.failNextDepartmentAssign = false;
          throw new Error('database unavailable');
        }

        let count = 0;
        for (const [departmentId, department] of departmentStore.entries()) {
          const matchesDoctor =
            where.assignedDoctorUserId === undefined ||
            department.assignedDoctorUserId === where.assignedDoctorUserId;
          const matchesNot = where.NOT?.id ? departmentId !== where.NOT.id : true;

          if (matchesDoctor && matchesNot) {
            departmentStore.set(departmentId, {
              ...department,
              ...data,
              updatedAt: new Date(),
            });
            count += 1;
          }
        }

        return { count };
      },
      update: async ({ where, data, select }: { where: { id: string }; data: any; select?: any }) => {
        if (dbState.failNextDepartmentAssign) {
          dbState.failNextDepartmentAssign = false;
          throw new Error('database unavailable');
        }

        const current = departmentStore.get(where.id);
        if (!current) {
          throw new Error('department not found');
        }

        const updated = {
          ...current,
          ...data,
          updatedAt: new Date(),
        };
        departmentStore.set(where.id, updated);

        return shapeDepartmentRecord(updated, select);
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

const findUserByUsername = (username: string) =>
  Array.from(userStore.values()).find((user) => user.username === username);

describe('admin configuration routes', () => {
  beforeEach(() => {
    departmentStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextDepartmentCreate = false;
    dbState.failNextDepartmentList = false;
    dbState.failNextDepartmentAssign = false;
    dbState.malformedNextDepartmentList = false;
    vi.restoreAllMocks();
  });

  it('should allow admins to create, list, and assign departments with structured logs', async () => {
    const app = createApp();
    const loggerInfoSpy = vi.spyOn(logger, 'info');
    const accessToken = await loginAs(app, 'admin');
    await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    expect(doctor).toBeDefined();

    const createResponse = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      success: true,
      data: expect.objectContaining({
        name: 'Cardiology',
        assignmentCount: 0,
        assignedDoctor: null,
      }),
    });

    const assignResponse = await request(app)
      .put(`/api/v1/admin/config/departments/${createResponse.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: doctor!.id });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: createResponse.body.data.id,
        name: 'Cardiology',
        assignmentCount: 1,
        assignedDoctor: {
          id: doctor!.id,
          username: 'doctor',
        },
      }),
    });

    const listResponse = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      success: true,
      data: [
        {
          id: createResponse.body.data.id,
          name: 'Cardiology',
          assignmentCount: 1,
          assignedDoctor: {
            id: doctor!.id,
            username: 'doctor',
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        departmentName: 'Cardiology',
        assignmentCount: 0,
      }),
      'admin_config_department_created',
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        departmentName: 'Cardiology',
        doctorUserId: doctor!.id,
        assignmentCount: 1,
      }),
      'admin_config_doctor_assigned',
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        departmentCount: 1,
        assignmentCount: 1,
        assignedDoctorIds: [doctor!.id],
      }),
      'admin_config_departments_read',
    );
  });

  it('should reassign a doctor from one department to another atomically', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');
    await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    expect(doctor).toBeDefined();

    const firstDepartment = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });
    const secondDepartment = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Neurology' });

    await request(app)
      .put(`/api/v1/admin/config/departments/${firstDepartment.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: doctor!.id })
      .expect(200);

    await request(app)
      .put(`/api/v1/admin/config/departments/${secondDepartment.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: doctor!.id })
      .expect(200);

    const listResponse = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual([
      expect.objectContaining({
        id: firstDepartment.body.data.id,
        name: 'Cardiology',
        assignmentCount: 0,
        assignedDoctor: null,
      }),
      expect.objectContaining({
        id: secondDepartment.body.data.id,
        name: 'Neurology',
        assignmentCount: 1,
        assignedDoctor: {
          id: doctor!.id,
          username: 'doctor',
        },
      }),
    ]);
  });

  it('should reject missing auth, invalid tokens, and non-admin callers', async () => {
    const app = createApp();

    const missingTokenResponse = await request(app)
      .post('/api/v1/admin/config/departments')
      .send({ name: 'Cardiology' });
    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.body.error.code).toBe('MISSING_BEARER_TOKEN');

    const invalidTokenResponse = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', 'Bearer definitely-not-a-valid-token');
    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body.error.code).toBe('INVALID_ACCESS_TOKEN');

    const receptionistToken = await loginAs(app, 'reception');
    const receptionistResponse = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(receptionistResponse.status).toBe(403);
    expect(receptionistResponse.body.error.code).toBe('FORBIDDEN');

    const doctorToken = await loginAs(app, 'doctor');
    const doctorResponse = await request(app)
      .put('/api/v1/admin/config/departments/department_1/doctor-assignment')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ doctorUserId: 'user_1' });
    expect(doctorResponse.status).toBe(403);
    expect(doctorResponse.body.error.code).toBe('FORBIDDEN');
  });

  it('should reject malformed department and assignment payloads', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');
    const department = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });

    const blankNameResponse = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' });
    expect(blankNameResponse.status).toBe(400);
    expect(blankNameResponse.body.error.code).toBe('VALIDATION_ERROR');

    const oversizedNameResponse = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'C'.repeat(121) });
    expect(oversizedNameResponse.status).toBe(400);
    expect(oversizedNameResponse.body.error.code).toBe('VALIDATION_ERROR');

    const missingDoctorResponse = await request(app)
      .put(`/api/v1/admin/config/departments/${department.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(missingDoctorResponse.status).toBe(400);
    expect(missingDoctorResponse.body.error.code).toBe('VALIDATION_ERROR');

    const nonStringDoctorResponse = await request(app)
      .put(`/api/v1/admin/config/departments/${department.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: 123 });
    expect(nonStringDoctorResponse.status).toBe(400);
    expect(nonStringDoctorResponse.body.error.code).toBe('VALIDATION_ERROR');

    const invalidDepartmentParamResponse = await request(app)
      .put('/api/v1/admin/config/departments/%20/doctor-assignment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: 'user_1' });
    expect(invalidDepartmentParamResponse.status).toBe(400);
    expect(invalidDepartmentParamResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject duplicate department names and invalid doctor targets with explicit envelopes', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'admin');
    const department = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });

    const duplicateResponse = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({
      success: false,
      error: {
        code: 'DEPARTMENT_NAME_CONFLICT',
        message: 'Department name already exists',
      },
    });

    const receptionist = findUserByUsername('reception');
    expect(receptionist).toBeDefined();

    const wrongRoleResponse = await request(app)
      .put(`/api/v1/admin/config/departments/${department.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: receptionist!.id });
    expect(wrongRoleResponse.status).toBe(422);
    expect(wrongRoleResponse.body).toEqual({
      success: false,
      error: {
        code: 'DOCTOR_ASSIGNMENT_TARGET_NOT_DOCTOR',
        message: 'Doctor assignment target must be an active doctor principal',
      },
    });

    await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    expect(doctor).toBeDefined();
    doctor!.isActive = false;
    userStore.set(doctor!.id, doctor);

    const inactiveDoctorResponse = await request(app)
      .put(`/api/v1/admin/config/departments/${department.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: doctor!.id });
    expect(inactiveDoctorResponse.status).toBe(404);
    expect(inactiveDoctorResponse.body).toEqual({
      success: false,
      error: {
        code: 'DOCTOR_NOT_FOUND',
        message: 'Doctor not found',
      },
    });
  });

  it('should fail closed with OPD_UNAVAILABLE on create, list, assign, and malformed list payloads', async () => {
    const app = createApp();
    const loggerErrorSpy = vi.spyOn(logger, 'error');
    const accessToken = await loginAs(app, 'admin');
    await loginAs(app, 'doctor');
    const doctor = findUserByUsername('doctor');
    expect(doctor).toBeDefined();

    dbState.failNextDepartmentCreate = true;
    const createFailure = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Cardiology' });
    expect(createFailure.status).toBe(503);
    expect(createFailure.body.error.code).toBe('OPD_UNAVAILABLE');

    const department = await request(app)
      .post('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Radiology' });
    expect(department.status).toBe(201);

    dbState.failNextDepartmentAssign = true;
    const assignFailure = await request(app)
      .put(`/api/v1/admin/config/departments/${department.body.data.id}/doctor-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctorUserId: doctor!.id });
    expect(assignFailure.status).toBe(503);
    expect(assignFailure.body.error.code).toBe('OPD_UNAVAILABLE');

    dbState.failNextDepartmentList = true;
    const listFailure = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listFailure.status).toBe(503);
    expect(listFailure.body.error.code).toBe('OPD_UNAVAILABLE');

    dbState.malformedNextDepartmentList = true;
    const malformedListFailure = await request(app)
      .get('/api/v1/admin/config/departments')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(malformedListFailure.status).toBe(503);
    expect(malformedListFailure.body.error.code).toBe('OPD_UNAVAILABLE');

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        errorCode: 'OPD_UNAVAILABLE',
      }),
      'admin_config_department_create_failed',
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        errorCode: 'OPD_UNAVAILABLE',
      }),
      'admin_config_doctor_assignment_failed',
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: UserRole.ADMIN,
        actorUserId: expect.any(String),
        errorCode: 'OPD_UNAVAILABLE',
      }),
      'admin_config_departments_read_failed',
    );
  });
});
