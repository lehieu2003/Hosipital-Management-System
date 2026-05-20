import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BedMovementType,
  BillingPaymentStatus,
  BillingSettlementStatus,
  BillingTransitionType,
  InpatientAdmissionStatus,
  UserRole,
} from '@prisma/client';

const {
  admissionStore,
  bedOccupancyStore,
  bedStore,
  billingInvoiceStore,
  billingTransitionStore,
  dbMock,
  movementStore,
  patientStore,
  refreshSessionStore,
  userStore,
} = vi.hoisted(() => {
  const admissionStore = new Map<string, any>();
  const bedOccupancyStore = new Map<string, any>();
  const bedStore = new Map<string, any>();
  const billingInvoiceStore = new Map<string, any>();
  const billingTransitionStore = new Map<string, any>();
  const movementStore = new Map<string, any>();
  const patientStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();

  const findUserById = (id: string) => userStore.get(id) ?? null;
  const findPatientById = (id: string) => patientStore.get(id) ?? null;
  const findBedById = (id: string) => bedStore.get(id) ?? null;
  const findCurrentOccupancyByAdmissionId = (admissionId: string) =>
    Array.from(bedOccupancyStore.values()).find((entry) => entry.admissionId === admissionId) ?? null;
  const findCurrentOccupancyByBedId = (bedId: string) =>
    Array.from(bedOccupancyStore.values()).find((entry) => entry.bedId === bedId) ?? null;

  const serializeBed = (bed: any) => ({
    id: bed.id,
    bedNumber: bed.bedNumber,
    wardName: bed.wardName,
    roomNumber: bed.roomNumber,
    isActive: bed.isActive,
    createdAt: bed.createdAt,
    updatedAt: bed.updatedAt,
  });

  const serializeOperator = (user: any) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
  });

  const serializeAdmission = (admission: any) => {
    const occupancy = findCurrentOccupancyByAdmissionId(admission.id);

    return {
      id: admission.id,
      patientId: admission.patientId,
      status: admission.status,
      attendingDoctorUserId: admission.attendingDoctorUserId ?? null,
      admittedByUserId: admission.admittedByUserId,
      admittedAt: admission.admittedAt,
      dischargeAt: admission.dischargeAt ?? null,
      dischargeNotes: admission.dischargeNotes ?? null,
      dischargedByUserId: admission.dischargedByUserId ?? null,
      notes: admission.notes ?? null,
      version: admission.version,
      createdAt: admission.createdAt,
      updatedAt: admission.updatedAt,
      currentBedOccupancy: occupancy
        ? {
            id: occupancy.id,
            admissionId: occupancy.admissionId,
            bedId: occupancy.bedId,
            assignedByUserId: occupancy.assignedByUserId,
            assignedAt: occupancy.assignedAt,
            lastTransferredAt: occupancy.lastTransferredAt ?? null,
            version: occupancy.version,
            createdAt: occupancy.createdAt,
            updatedAt: occupancy.updatedAt,
            bed: serializeBed(findBedById(occupancy.bedId)),
            assignedByUser: serializeOperator(findUserById(occupancy.assignedByUserId)),
          }
        : null,
    };
  };

  const serializeMovement = (movement: any) => ({
    id: movement.id,
    admissionId: movement.admissionId,
    movementType: movement.movementType,
    fromBedId: movement.fromBedId ?? null,
    toBedId: movement.toBedId ?? null,
    movedByUserId: movement.movedByUserId,
    movedAt: movement.movedAt,
    note: movement.note ?? null,
    createdAt: movement.createdAt,
    fromBed: movement.fromBedId ? serializeBed(findBedById(movement.fromBedId)) : null,
    toBed: movement.toBedId ? serializeBed(findBedById(movement.toBedId)) : null,
    movedByUser: serializeOperator(findUserById(movement.movedByUserId)),
  });

  const serializeBillingTransition = (transition: any) => ({
    id: transition.id,
    invoiceId: transition.invoiceId,
    transitionType: transition.transitionType,
    fromPaymentStatus: transition.fromPaymentStatus ?? null,
    toPaymentStatus: transition.toPaymentStatus,
    fromSettlementStatus: transition.fromSettlementStatus ?? null,
    toSettlementStatus: transition.toSettlementStatus,
    balanceMinor: transition.balanceMinor,
    context: transition.context ?? null,
    actorUserId: transition.actorUserId ?? null,
    createdAt: transition.createdAt,
    actorUser: transition.actorUserId ? serializeOperator(findUserById(transition.actorUserId)) : null,
  });

  const serializeBillingInvoice = (invoice: any) => {
    const patient = findPatientById(invoice.patientId);
    const transitions = Array.from(billingTransitionStore.values())
      .filter((entry) => entry.invoiceId === invoice.id)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(serializeBillingTransition);

    return {
      id: invoice.id,
      admissionId: invoice.admissionId,
      patientId: invoice.patientId,
      paymentStatus: invoice.paymentStatus,
      settlementStatus: invoice.settlementStatus,
      currency: invoice.currency,
      totalChargesMinor: invoice.totalChargesMinor,
      totalPaymentsMinor: invoice.totalPaymentsMinor,
      balanceMinor: invoice.balanceMinor,
      dischargedAt: invoice.dischargedAt ?? null,
      settledAt: invoice.settledAt ?? null,
      version: invoice.version,
      createdByUserId: invoice.createdByUserId ?? null,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      patient: {
        id: patient.id,
        registrationNumber: patient.registrationNumber,
        fullName: patient.fullName,
        primaryPhone: patient.primaryPhone,
      },
      createdByUser: invoice.createdByUserId ? serializeOperator(findUserById(invoice.createdByUserId)) : null,
      lines: [],
      payments: [],
      transitions,
    };
  };

  const serializeOccupancy = (occupancy: any) => {
    const admission = admissionStore.get(occupancy.admissionId);
    const patient = findPatientById(admission.patientId);

    return {
      id: occupancy.id,
      admissionId: occupancy.admissionId,
      bedId: occupancy.bedId,
      assignedByUserId: occupancy.assignedByUserId,
      assignedAt: occupancy.assignedAt,
      lastTransferredAt: occupancy.lastTransferredAt ?? null,
      version: occupancy.version,
      createdAt: occupancy.createdAt,
      updatedAt: occupancy.updatedAt,
      bed: serializeBed(findBedById(occupancy.bedId)),
      assignedByUser: serializeOperator(findUserById(occupancy.assignedByUserId)),
      admission: {
        id: admission.id,
        patientId: admission.patientId,
        status: admission.status,
        admittedAt: admission.admittedAt,
        dischargeAt: admission.dischargeAt ?? null,
        version: admission.version,
        patient: {
          id: patient.id,
          registrationNumber: patient.registrationNumber,
          fullName: patient.fullName,
          primaryPhone: patient.primaryPhone,
        },
      },
    };
  };

  const uniqueBedError = () => ({ code: 'P2002', meta: { target: ['bed_id'] } });

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
      findUnique: async ({ where }: { where: { id: string } }) => findPatientById(where.id),
    },
    bed: {
      findUnique: async ({ where }: { where: { id: string } }) => findBedById(where.id),
    },
    inpatientAdmission: {
      create: async ({ data }: { data: any }) => {
        const id = `admission_${admissionStore.size + 1}`;
        const now = data.admittedAt ?? new Date();
        const record = {
          id,
          patientId: data.patientId,
          status: InpatientAdmissionStatus.ADMITTED,
          attendingDoctorUserId: data.attendingDoctorUserId ?? null,
          admittedByUserId: data.admittedByUserId,
          admittedAt: data.admittedAt ?? now,
          dischargeAt: null,
          dischargeNotes: null,
          dischargedByUserId: null,
          notes: data.notes ?? null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };

        admissionStore.set(id, record);
        return serializeAdmission(record);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const admission = admissionStore.get(where.id);
        return admission ? serializeAdmission(admission) : null;
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        const admission = admissionStore.get(where.id);
        if (!admission || admission.status !== where.status || admission.version !== where.version) {
          return { count: 0 };
        }

        const nextVersion = admission.version + (data.version?.increment ?? 0);
        const updated = {
          ...admission,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.dischargeAt !== undefined ? { dischargeAt: data.dischargeAt } : {}),
          ...(data.dischargeNotes !== undefined ? { dischargeNotes: data.dischargeNotes } : {}),
          ...(data.dischargedByUserId !== undefined ? { dischargedByUserId: data.dischargedByUserId } : {}),
          version: nextVersion,
          updatedAt: new Date('2026-05-15T12:00:00.000Z'),
        };

        admissionStore.set(where.id, updated);
        return { count: 1 };
      },
    },
    bedOccupancy: {
      create: async ({ data }: { data: any }) => {
        if (findCurrentOccupancyByBedId(data.bedId)) {
          throw uniqueBedError();
        }

        if (findCurrentOccupancyByAdmissionId(data.admissionId)) {
          throw { code: 'P2002', meta: { target: ['admission_id'] } };
        }

        const id = `occupancy_${bedOccupancyStore.size + 1}`;
        const now = new Date('2026-05-15T10:00:00.000Z');
        const record = {
          id,
          admissionId: data.admissionId,
          bedId: data.bedId,
          assignedByUserId: data.assignedByUserId,
          assignedAt: now,
          lastTransferredAt: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };

        bedOccupancyStore.set(id, record);
        return record;
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        const occupancy = bedOccupancyStore.get(where.id);
        if (
          !occupancy ||
          occupancy.admissionId !== where.admissionId ||
          occupancy.bedId !== where.bedId ||
          occupancy.version !== where.version
        ) {
          return { count: 0 };
        }

        const occupiedTarget = findCurrentOccupancyByBedId(data.bedId);
        if (occupiedTarget && occupiedTarget.id !== occupancy.id) {
          throw uniqueBedError();
        }

        const updated = {
          ...occupancy,
          bedId: data.bedId,
          assignedByUserId: data.assignedByUserId,
          lastTransferredAt: data.lastTransferredAt,
          version: occupancy.version + (data.version?.increment ?? 0),
          updatedAt: new Date('2026-05-15T11:00:00.000Z'),
        };

        bedOccupancyStore.set(where.id, updated);
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: any }) => {
        const occupancy = bedOccupancyStore.get(where.id);
        if (
          !occupancy ||
          occupancy.admissionId !== where.admissionId ||
          occupancy.bedId !== where.bedId ||
          occupancy.version !== where.version
        ) {
          return { count: 0 };
        }

        bedOccupancyStore.delete(where.id);
        return { count: 1 };
      },
      findMany: async () => {
        return Array.from(bedOccupancyStore.values())
          .sort((left, right) => left.assignedAt.getTime() - right.assignedAt.getTime() || left.id.localeCompare(right.id))
          .map(serializeOccupancy);
      },
    },
    inpatientBedMovement: {
      create: async ({ data }: { data: any }) => {
        const id = `movement_${movementStore.size + 1}`;
        const now = new Date(`2026-05-15T10:0${movementStore.size}:00.000Z`);
        const record = {
          id,
          admissionId: data.admissionId,
          movementType: data.movementType,
          fromBedId: data.fromBedId ?? null,
          toBedId: data.toBedId ?? null,
          movedByUserId: data.movedByUserId,
          movedAt: now,
          note: data.note ?? null,
          createdAt: now,
        };

        movementStore.set(id, record);
        return serializeMovement(record);
      },
      findMany: async ({ where }: { where: { admissionId: string } }) => {
        return Array.from(movementStore.values())
          .filter((movement) => movement.admissionId === where.admissionId)
          .sort((left, right) => left.movedAt.getTime() - right.movedAt.getTime() || left.id.localeCompare(right.id))
          .map(serializeMovement);
      },
    },
    billingInvoice: {
      findUnique: async ({ where }: { where: { id?: string; admissionId?: string } }) => {
        if (where.id) {
          const invoice = billingInvoiceStore.get(where.id);
          return invoice ? serializeBillingInvoice(invoice) : null;
        }

        const invoice = Array.from(billingInvoiceStore.values()).find((entry) => entry.admissionId === where.admissionId);
        return invoice ? serializeBillingInvoice(invoice) : null;
      },
      create: async ({ data }: { data: any }) => {
        const id = `invoice_${billingInvoiceStore.size + 1}`;
        const now = new Date('2026-05-15T12:30:00.000Z');
        const record = {
          id,
          admissionId: data.admissionId,
          patientId: data.patientId,
          paymentStatus: data.paymentStatus ?? BillingPaymentStatus.UNPAID,
          settlementStatus: data.settlementStatus ?? BillingSettlementStatus.OPEN,
          currency: data.currency ?? 'USD',
          totalChargesMinor: data.totalChargesMinor ?? 0,
          totalPaymentsMinor: data.totalPaymentsMinor ?? 0,
          balanceMinor: data.balanceMinor ?? 0,
          dischargedAt: data.dischargedAt ?? null,
          settledAt: data.settledAt ?? null,
          version: data.version ?? 1,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: now,
          updatedAt: now,
        };

        billingInvoiceStore.set(id, record);
        return { id };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const invoice = billingInvoiceStore.get(where.id);
        if (!invoice) {
          throw new Error(`Invoice ${where.id} not found`);
        }

        const updated = {
          ...invoice,
          ...(data.dischargedAt !== undefined ? { dischargedAt: data.dischargedAt } : {}),
          ...(data.settlementStatus !== undefined ? { settlementStatus: data.settlementStatus } : {}),
          ...(data.settledAt !== undefined ? { settledAt: data.settledAt } : {}),
          ...(data.totalChargesMinor !== undefined ? { totalChargesMinor: data.totalChargesMinor } : {}),
          ...(data.totalPaymentsMinor !== undefined ? { totalPaymentsMinor: data.totalPaymentsMinor } : {}),
          ...(data.balanceMinor !== undefined ? { balanceMinor: data.balanceMinor } : {}),
          ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus } : {}),
          version: invoice.version + (data.version?.increment ?? 0),
          updatedAt: new Date('2026-05-15T12:45:00.000Z'),
        };

        billingInvoiceStore.set(where.id, updated);
        return { id: where.id };
      },
    },
    billingTransitionHistory: {
      create: async ({ data }: { data: any }) => {
        const id = `billing_transition_${billingTransitionStore.size + 1}`;
        const createdAt = new Date(`2026-05-15T12:4${billingTransitionStore.size}:00.000Z`);
        const record = {
          id,
          invoiceId: data.invoiceId,
          transitionType: data.transitionType,
          fromPaymentStatus: data.fromPaymentStatus ?? null,
          toPaymentStatus: data.toPaymentStatus,
          fromSettlementStatus: data.fromSettlementStatus ?? null,
          toSettlementStatus: data.toSettlementStatus,
          balanceMinor: data.balanceMinor,
          context: data.context ?? null,
          actorUserId: data.actorUserId ?? null,
          createdAt,
        };

        billingTransitionStore.set(id, record);
        return serializeBillingTransition(record);
      },
    },
  };

  return {
    admissionStore,
    bedOccupancyStore,
    bedStore,
    billingInvoiceStore,
    billingTransitionStore,
    dbMock,
    movementStore,
    patientStore,
    refreshSessionStore,
    userStore,
  };
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
    fullName: `Patient ${patientStore.size + 1}`,
    primaryPhone: `+15550001${patientStore.size + 1}`,
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

const seedBed = (overrides: Record<string, unknown> = {}) => {
  const id = `bed_${bedStore.size + 1}`;
  const now = new Date('2026-05-15T08:15:00.000Z');
  const record = {
    id,
    bedNumber: `B-${bedStore.size + 1}`,
    wardName: 'Ward A',
    roomNumber: `10${bedStore.size + 1}`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  bedStore.set(id, record);
  return record;
};

describe('ipd lifecycle routes', () => {
  beforeEach(() => {
    admissionStore.clear();
    bedOccupancyStore.clear();
    bedStore.clear();
    billingInvoiceStore.clear();
    billingTransitionStore.clear();
    movementStore.clear();
    patientStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
  });

  it('serves admission, occupancy, transfer, discharge, history, and occupied-target conflict flows through /ipd', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const patientOne = seedPatient({ fullName: 'Jane Doe' });
    const patientTwo = seedPatient({ fullName: 'John Doe' });
    const bedOne = seedBed({ bedNumber: 'A-101', roomNumber: '101' });
    const bedTwo = seedBed({ bedNumber: 'B-202', roomNumber: '202' });

    const admitOneResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patientOne.id,
        notes: 'Observation required',
      });

    expect(admitOneResponse.status).toBe(201);
    expect(admitOneResponse.body.data).toEqual(
      expect.objectContaining({
        patientId: patientOne.id,
        status: InpatientAdmissionStatus.ADMITTED,
        notes: 'Observation required',
        version: 1,
        currentBedOccupancy: null,
      }),
    );

    const admissionOneId = admitOneResponse.body.data.id as string;

    const assignOneResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionOneId}/bed-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bedId: bedOne.id,
        expectedAdmissionVersion: 1,
        note: 'Initial assignment',
      });

    expect(assignOneResponse.status).toBe(200);
    expect(assignOneResponse.body.data.admission).toEqual(
      expect.objectContaining({
        id: admissionOneId,
        version: 2,
        currentBedOccupancy: expect.objectContaining({
          bedId: bedOne.id,
          version: 1,
        }),
      }),
    );
    expect(assignOneResponse.body.data.movement).toEqual(
      expect.objectContaining({
        movementType: BedMovementType.ASSIGNED,
        toBedId: bedOne.id,
        note: 'Initial assignment',
      }),
    );

    const occupancyAfterAssignResponse = await request(app)
      .get('/api/v1/ipd/occupancy')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(occupancyAfterAssignResponse.status).toBe(200);
    expect(occupancyAfterAssignResponse.body.data).toEqual([
      expect.objectContaining({
        bedId: bedOne.id,
        version: 1,
        admission: expect.objectContaining({
          id: admissionOneId,
          patient: expect.objectContaining({
            id: patientOne.id,
            fullName: 'Jane Doe',
          }),
        }),
      }),
    ]);

    const historyAfterAssignResponse = await request(app)
      .get(`/api/v1/ipd/admissions/${admissionOneId}/movements`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(historyAfterAssignResponse.status).toBe(200);
    expect(historyAfterAssignResponse.body.data).toHaveLength(1);
    expect(historyAfterAssignResponse.body.data[0]).toEqual(
      expect.objectContaining({
        movementType: BedMovementType.ASSIGNED,
        toBedId: bedOne.id,
      }),
    );

    const transferOneResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionOneId}/bed-transfer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetBedId: bedTwo.id,
        expectedAdmissionVersion: 2,
        expectedOccupancyVersion: 1,
        note: 'Escalated to monitored room',
      });

    expect(transferOneResponse.status).toBe(200);
    expect(transferOneResponse.body.data.admission).toEqual(
      expect.objectContaining({
        id: admissionOneId,
        version: 3,
        currentBedOccupancy: expect.objectContaining({
          bedId: bedTwo.id,
          version: 2,
        }),
      }),
    );
    expect(transferOneResponse.body.data.movement).toEqual(
      expect.objectContaining({
        movementType: BedMovementType.TRANSFERRED,
        fromBedId: bedOne.id,
        toBedId: bedTwo.id,
        note: 'Escalated to monitored room',
      }),
    );

    const admitTwoResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patientTwo.id,
      });

    expect(admitTwoResponse.status).toBe(201);
    const admissionTwoId = admitTwoResponse.body.data.id as string;

    const assignTwoResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionTwoId}/bed-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bedId: bedOne.id,
        expectedAdmissionVersion: 1,
      });

    expect(assignTwoResponse.status).toBe(200);
    expect(assignTwoResponse.body.data.admission.currentBedOccupancy.bedId).toBe(bedOne.id);

    const occupiedTransferResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionTwoId}/bed-transfer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetBedId: bedTwo.id,
        expectedAdmissionVersion: 2,
        expectedOccupancyVersion: 1,
      });

    expect(occupiedTransferResponse.status).toBe(409);
    expect(occupiedTransferResponse.body).toEqual({
      success: false,
      error: {
        code: 'BED_OCCUPANCY_CONFLICT',
        message: 'Target bed is already occupied',
      },
    });

    const dischargeOneResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionOneId}/discharge`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expectedAdmissionVersion: 3,
        expectedOccupancyVersion: 2,
        dischargeNotes: 'Recovered and sent home',
        movementNote: 'Bed released after discharge',
      });

    expect(dischargeOneResponse.status).toBe(200);
    expect(dischargeOneResponse.body.data.admission).toEqual(
      expect.objectContaining({
        id: admissionOneId,
        status: InpatientAdmissionStatus.DISCHARGED,
        version: 4,
        dischargeNotes: 'Recovered and sent home',
        currentBedOccupancy: null,
      }),
    );
    expect(dischargeOneResponse.body.data.movement).toEqual(
      expect.objectContaining({
        movementType: BedMovementType.DISCHARGED,
        fromBedId: bedTwo.id,
        toBedId: null,
        note: 'Bed released after discharge',
      }),
    );

    const dischargeSyncedInvoice = Array.from(billingInvoiceStore.values()).find(
      (invoice) => invoice.admissionId === admissionOneId,
    );
    expect(dischargeSyncedInvoice).toEqual(
      expect.objectContaining({
        dischargedAt: expect.any(Date),
        settlementStatus: BillingSettlementStatus.SETTLED,
        balanceMinor: 0,
      }),
    );

    const occupancyAfterDischargeResponse = await request(app)
      .get('/api/v1/ipd/occupancy')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(occupancyAfterDischargeResponse.status).toBe(200);
    expect(occupancyAfterDischargeResponse.body.data).toHaveLength(1);
    expect(occupancyAfterDischargeResponse.body.data[0]).toEqual(
      expect.objectContaining({
        bedId: bedOne.id,
        admission: expect.objectContaining({
          id: admissionTwoId,
          patient: expect.objectContaining({
            id: patientTwo.id,
          }),
        }),
      }),
    );

    const historyAfterDischargeResponse = await request(app)
      .get(`/api/v1/ipd/admissions/${admissionOneId}/movements`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(historyAfterDischargeResponse.status).toBe(200);
    expect(historyAfterDischargeResponse.body.data.map((movement: { movementType: string }) => movement.movementType)).toEqual([
      BedMovementType.ASSIGNED,
      BedMovementType.TRANSFERRED,
      BedMovementType.DISCHARGED,
    ]);
  });

  it('rejects invalid-state transitions once an admission has been discharged', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();
    const firstBed = seedBed();
    const secondBed = seedBed({ bedNumber: 'B-2' });

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ patientId: patient.id });

    const admissionId = admitResponse.body.data.id as string;

    await request(app)
      .post(`/api/v1/ipd/admissions/${admissionId}/bed-assignment`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bedId: firstBed.id,
        expectedAdmissionVersion: 1,
      })
      .expect(200);

    await request(app)
      .post(`/api/v1/ipd/admissions/${admissionId}/discharge`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expectedAdmissionVersion: 2,
        expectedOccupancyVersion: 1,
      })
      .expect(200);

    const response = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionId}/bed-transfer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetBedId: secondBed.id,
        expectedAdmissionVersion: 3,
        expectedOccupancyVersion: 1,
      });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMISSION_INVALID_STATUS_TRANSITION',
        message: 'Only admitted patients can transfer beds',
      },
    });
  });

  it('denies doctor principals before reaching reception-owned ipd routes', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const response = await request(app)
      .get('/api/v1/ipd/occupancy')
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

  it('returns validation details for malformed ipd lifecycle payloads', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');

    const createResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: '',
        admittedAt: 'not-a-date',
      });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(createResponse.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'patientId' }),
        expect.objectContaining({ path: 'admittedAt' }),
      ]),
    );

    const transferResponse = await request(app)
      .post('/api/v1/ipd/admissions/admission_999/bed-transfer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetBedId: '',
        expectedAdmissionVersion: '2',
      });

    expect(transferResponse.status).toBe(400);
    expect(transferResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(transferResponse.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'targetBedId' }),
        expect.objectContaining({ path: 'expectedAdmissionVersion' }),
        expect.objectContaining({ path: 'expectedOccupancyVersion' }),
      ]),
    );
  });
});
