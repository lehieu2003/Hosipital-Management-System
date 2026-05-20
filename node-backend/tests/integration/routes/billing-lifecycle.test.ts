import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BillingInvoiceLineType,
  BillingPaymentStatus,
  BillingSettlementStatus,
  BillingTransitionType,
  InpatientAdmissionStatus,
  UserRole,
} from '@prisma/client';

const {
  admissionStore,
  billingChargeReplayStore,
  billingInvoiceLineStore,
  billingInvoiceStore,
  billingPaymentStore,
  billingTransitionStore,
  dbMock,
  dbState,
  patientStore,
  refreshSessionStore,
  userStore,
} = vi.hoisted(() => {
  const admissionStore = new Map<string, any>();
  const billingChargeReplayStore = new Map<string, any>();
  const billingInvoiceLineStore = new Map<string, any>();
  const billingInvoiceStore = new Map<string, any>();
  const billingPaymentStore = new Map<string, any>();
  const billingTransitionStore = new Map<string, any>();
  const patientStore = new Map<string, any>();
  const refreshSessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const dbState = {
    failNextBillingInvoiceRead: false,
    failNextBillingChargeCreate: false,
    failNextBillingPaymentCreate: false,
  };

  const findUserById = (id: string) => userStore.get(id) ?? null;
  const findPatientById = (id: string) => patientStore.get(id) ?? null;

  const serializeActor = (user: any) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
  });

  const serializeInvoiceLine = (line: any) => ({
    id: line.id,
    invoiceId: line.invoiceId,
    lineType: line.lineType,
    chargeCode: line.chargeCode ?? null,
    description: line.description,
    quantity: line.quantity,
    unitAmountMinor: line.unitAmountMinor,
    lineAmountMinor: line.lineAmountMinor,
    metadata: line.metadata ?? null,
    createdByUserId: line.createdByUserId ?? null,
    createdAt: line.createdAt,
    createdByUser: line.createdByUserId ? serializeActor(findUserById(line.createdByUserId)) : null,
  });

  const serializePayment = (payment: any) => ({
    id: payment.id,
    invoiceId: payment.invoiceId,
    amountMinor: payment.amountMinor,
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference ?? null,
    note: payment.note ?? null,
    recordedByUserId: payment.recordedByUserId ?? null,
    receivedAt: payment.receivedAt,
    createdAt: payment.createdAt,
    recordedByUser: payment.recordedByUserId ? serializeActor(findUserById(payment.recordedByUserId)) : null,
  });

  const serializeTransition = (transition: any) => ({
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
    actorUser: transition.actorUserId ? serializeActor(findUserById(transition.actorUserId)) : null,
  });

  const serializeInvoice = (invoice: any) => {
    const patient = findPatientById(invoice.patientId);
    const lines = Array.from(billingInvoiceLineStore.values())
      .filter((entry) => entry.invoiceId === invoice.id)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(serializeInvoiceLine);
    const payments = Array.from(billingPaymentStore.values())
      .filter((entry) => entry.invoiceId === invoice.id)
      .sort((left, right) => left.receivedAt.getTime() - right.receivedAt.getTime() || left.id.localeCompare(right.id))
      .map(serializePayment);
    const transitions = Array.from(billingTransitionStore.values())
      .filter((entry) => entry.invoiceId === invoice.id)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(serializeTransition);

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
      createdByUser: invoice.createdByUserId ? serializeActor(findUserById(invoice.createdByUserId)) : null,
      lines,
      payments,
      transitions,
    };
  };

  const serializeAdmission = (admission: any) => ({
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
    currentBedOccupancy: null,
  });

  const findInvoiceByAdmissionId = (admissionId: string) =>
    Array.from(billingInvoiceStore.values()).find((entry) => entry.admissionId === admissionId) ?? null;

  const replayKey = (invoiceId: string, idempotencyKey: string) => `${invoiceId}::${idempotencyKey}`;

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
    inpatientAdmission: {
      create: async ({ data }: { data: any }) => {
        const id = `admission_${admissionStore.size + 1}`;
        const now = data.admittedAt ?? new Date('2026-05-16T08:00:00.000Z');
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

        const updated = {
          ...admission,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.dischargeAt !== undefined ? { dischargeAt: data.dischargeAt } : {}),
          ...(data.dischargeNotes !== undefined ? { dischargeNotes: data.dischargeNotes } : {}),
          ...(data.dischargedByUserId !== undefined ? { dischargedByUserId: data.dischargedByUserId } : {}),
          version: admission.version + (data.version?.increment ?? 0),
          updatedAt: new Date('2026-05-16T12:00:00.000Z'),
        };

        admissionStore.set(where.id, updated);
        return { count: 1 };
      },
    },
    bedOccupancy: {
      deleteMany: async () => ({ count: 0 }),
    },
    inpatientBedMovement: {
      create: async () => {
        throw new Error('bed movement should not be created in billing lifecycle tests');
      },
    },
    billingInvoice: {
      findUnique: async ({ where }: { where: { id?: string; admissionId?: string } }) => {
        if (dbState.failNextBillingInvoiceRead) {
          dbState.failNextBillingInvoiceRead = false;
          throw new Error('billing invoice lookup unavailable');
        }

        const invoice = where.id
          ? billingInvoiceStore.get(where.id) ?? null
          : where.admissionId
            ? findInvoiceByAdmissionId(where.admissionId)
            : null;

        return invoice ? serializeInvoice(invoice) : null;
      },
      create: async ({ data }: { data: any }) => {
        const id = `invoice_${billingInvoiceStore.size + 1}`;
        const now = new Date('2026-05-16T08:30:00.000Z');
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
          throw new Error(`invoice ${where.id} not found`);
        }

        const updated = {
          ...invoice,
          ...(data.totalChargesMinor !== undefined ? { totalChargesMinor: data.totalChargesMinor } : {}),
          ...(data.totalPaymentsMinor !== undefined ? { totalPaymentsMinor: data.totalPaymentsMinor } : {}),
          ...(data.balanceMinor !== undefined ? { balanceMinor: data.balanceMinor } : {}),
          ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus } : {}),
          ...(data.settlementStatus !== undefined ? { settlementStatus: data.settlementStatus } : {}),
          ...(data.dischargedAt !== undefined ? { dischargedAt: data.dischargedAt } : {}),
          ...(data.settledAt !== undefined ? { settledAt: data.settledAt } : {}),
          version: invoice.version + (data.version?.increment ?? 0),
          updatedAt: new Date('2026-05-16T12:15:00.000Z'),
        };

        billingInvoiceStore.set(where.id, updated);
        return { id: updated.id };
      },
    },
    billingInvoiceLine: {
      create: async ({ data }: { data: any }) => {
        if (dbState.failNextBillingChargeCreate) {
          dbState.failNextBillingChargeCreate = false;
          throw new Error('billing charge create unavailable');
        }

        const id = `line_${billingInvoiceLineStore.size + 1}`;
        const now = new Date(`2026-05-16T09:0${billingInvoiceLineStore.size}:00.000Z`);
        const record = {
          id,
          invoiceId: data.invoiceId,
          lineType: data.lineType ?? BillingInvoiceLineType.CHARGE,
          chargeCode: data.chargeCode ?? null,
          description: data.description,
          quantity: data.quantity,
          unitAmountMinor: data.unitAmountMinor,
          lineAmountMinor: data.lineAmountMinor,
          metadata: data.metadata ?? null,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: now,
        };

        billingInvoiceLineStore.set(id, record);
        return serializeInvoiceLine(record);
      },
    },
    billingChargeIdempotency: {
      findUnique: async ({ where }: { where: { invoiceId_idempotencyKey: { invoiceId: string; idempotencyKey: string } } }) => {
        const entry = billingChargeReplayStore.get(
          replayKey(where.invoiceId_idempotencyKey.invoiceId, where.invoiceId_idempotencyKey.idempotencyKey),
        );

        if (!entry) {
          return null;
        }

        const line = billingInvoiceLineStore.get(entry.lineId);
        return {
          ...entry,
          createdByUser: entry.createdByUserId ? serializeActor(findUserById(entry.createdByUserId)) : null,
          line: serializeInvoiceLine(line),
        };
      },
      create: async ({ data }: { data: any }) => {
        const id = `replay_${billingChargeReplayStore.size + 1}`;
        const now = new Date(`2026-05-16T09:1${billingChargeReplayStore.size}:00.000Z`);
        const record = {
          id,
          invoiceId: data.invoiceId,
          lineId: data.lineId,
          idempotencyKey: data.idempotencyKey,
          requestHash: data.requestHash,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: now,
        };

        billingChargeReplayStore.set(replayKey(data.invoiceId, data.idempotencyKey), record);
        return record;
      },
    },
    billingPayment: {
      create: async ({ data }: { data: any }) => {
        if (dbState.failNextBillingPaymentCreate) {
          dbState.failNextBillingPaymentCreate = false;
          throw new Error('billing payment create unavailable');
        }

        const id = `payment_${billingPaymentStore.size + 1}`;
        const receivedAt = data.receivedAt ?? new Date(`2026-05-16T10:0${billingPaymentStore.size}:00.000Z`);
        const createdAt = new Date(`2026-05-16T10:1${billingPaymentStore.size}:00.000Z`);
        const record = {
          id,
          invoiceId: data.invoiceId,
          amountMinor: data.amountMinor,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference ?? null,
          note: data.note ?? null,
          recordedByUserId: data.recordedByUserId ?? null,
          receivedAt,
          createdAt,
        };

        billingPaymentStore.set(id, record);
        return serializePayment(record);
      },
    },
    billingTransitionHistory: {
      create: async ({ data }: { data: any }) => {
        const id = `transition_${billingTransitionStore.size + 1}`;
        const createdAt = new Date(`2026-05-16T08:${30 + billingTransitionStore.size}:00.000Z`);
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
        return serializeTransition(record);
      },
    },
  };

  return {
    admissionStore,
    billingChargeReplayStore,
    billingInvoiceLineStore,
    billingInvoiceStore,
    billingPaymentStore,
    billingTransitionStore,
    dbMock,
    dbState,
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

const seedPatient = (overrides: Record<string, unknown> = {}) => {
  const id = `patient_${patientStore.size + 1}`;
  const now = new Date('2026-05-16T07:30:00.000Z');
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

describe('billing lifecycle routes', () => {
  beforeEach(() => {
    admissionStore.clear();
    billingChargeReplayStore.clear();
    billingInvoiceLineStore.clear();
    billingInvoiceStore.clear();
    billingPaymentStore.clear();
    billingTransitionStore.clear();
    patientStore.clear();
    refreshSessionStore.clear();
    userStore.clear();
    dbState.failNextBillingInvoiceRead = false;
    dbState.failNextBillingChargeCreate = false;
    dbState.failNextBillingPaymentCreate = false;
  });

  it('proves admit to open invoice to charge to partial payment to discharge pending settlement to final settlement', async () => {
    const app = createApp();
    await loginAs(app, 'doctor');
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patientId: patient.id,
        notes: 'Observe overnight',
      });

    expect(admitResponse.status).toBe(201);
    const admissionId = admitResponse.body.data.id as string;

    const invoiceResponse = await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(invoiceResponse.status).toBe(200);
    expect(invoiceResponse.body.data).toEqual(
      expect.objectContaining({
        admissionId,
        patientId: patient.id,
        paymentStatus: BillingPaymentStatus.UNPAID,
        settlementStatus: BillingSettlementStatus.OPEN,
        totalChargesMinor: 0,
        totalPaymentsMinor: 0,
        balanceMinor: 0,
        version: 1,
      }),
    );
    expect(invoiceResponse.body.data.transitions).toHaveLength(1);
    expect(invoiceResponse.body.data.transitions[0].transitionType).toBe(BillingTransitionType.INVOICE_OPENED);

    const appendChargeResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chargeCode: 'ROOM_DAILY',
        description: 'Daily room charge',
        quantity: 2,
        unitAmountMinor: 2500,
        idempotencyKey: 'room-2026-05-16',
        metadata: { ward: 'A1' },
        expectedInvoiceVersion: 1,
      });

    expect(appendChargeResponse.status).toBe(200);
    expect(appendChargeResponse.body.data.line).toEqual(
      expect.objectContaining({
        chargeCode: 'ROOM_DAILY',
        description: 'Daily room charge',
        quantity: 2,
        unitAmountMinor: 2500,
        lineAmountMinor: 5000,
      }),
    );
    expect(appendChargeResponse.body.data.invoice).toEqual(
      expect.objectContaining({
        paymentStatus: BillingPaymentStatus.UNPAID,
        settlementStatus: BillingSettlementStatus.OPEN,
        totalChargesMinor: 5000,
        totalPaymentsMinor: 0,
        balanceMinor: 5000,
        version: 2,
      }),
    );
    expect(appendChargeResponse.body.data.transition.transitionType).toBe(BillingTransitionType.CHARGE_APPENDED);

    const partialPaymentResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountMinor: 2000,
        paymentMethod: 'cash',
        paymentReference: 'RCPT-1',
        note: 'Deposit',
        receivedAt: '2026-05-16T10:30:00.000Z',
        expectedInvoiceVersion: 2,
      });

    expect(partialPaymentResponse.status).toBe(200);
    expect(partialPaymentResponse.body.data.payment).toEqual(
      expect.objectContaining({
        amountMinor: 2000,
        paymentMethod: 'cash',
        paymentReference: 'RCPT-1',
      }),
    );
    expect(partialPaymentResponse.body.data.invoice).toEqual(
      expect.objectContaining({
        paymentStatus: BillingPaymentStatus.PARTIALLY_PAID,
        settlementStatus: BillingSettlementStatus.OPEN,
        totalChargesMinor: 5000,
        totalPaymentsMinor: 2000,
        balanceMinor: 3000,
        version: 3,
      }),
    );
    expect(partialPaymentResponse.body.data.transition.transitionType).toBe(BillingTransitionType.PAYMENT_RECORDED);

    const dischargeResponse = await request(app)
      .post(`/api/v1/ipd/admissions/${admissionId}/discharge`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expectedAdmissionVersion: 1,
        dischargedAt: '2026-05-16T11:00:00.000Z',
        dischargeNotes: 'Clinically stable for discharge',
      });

    expect(dischargeResponse.status).toBe(200);
    expect(dischargeResponse.body.data).toEqual(
      expect.objectContaining({
        admission: expect.objectContaining({
          id: admissionId,
          status: InpatientAdmissionStatus.DISCHARGED,
          version: 2,
          dischargeAt: '2026-05-16T11:00:00.000Z',
        }),
        movement: null,
      }),
    );

    const pendingInvoiceResponse = await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(pendingInvoiceResponse.status).toBe(200);
    expect(pendingInvoiceResponse.body.data).toEqual(
      expect.objectContaining({
        paymentStatus: BillingPaymentStatus.PARTIALLY_PAID,
        settlementStatus: BillingSettlementStatus.PENDING_SETTLEMENT,
        totalChargesMinor: 5000,
        totalPaymentsMinor: 2000,
        balanceMinor: 3000,
        dischargedAt: '2026-05-16T11:00:00.000Z',
        settledAt: null,
        version: 4,
      }),
    );
    expect(pendingInvoiceResponse.body.data.transitions.at(-1).transitionType).toBe(BillingTransitionType.DISCHARGE_SYNC);

    const finalPaymentResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountMinor: 3000,
        paymentMethod: 'card',
        paymentReference: 'RCPT-2',
        expectedInvoiceVersion: 4,
      });

    expect(finalPaymentResponse.status).toBe(200);
    expect(finalPaymentResponse.body.data.invoice).toEqual(
      expect.objectContaining({
        paymentStatus: BillingPaymentStatus.PAID_IN_FULL,
        settlementStatus: BillingSettlementStatus.SETTLED,
        totalChargesMinor: 5000,
        totalPaymentsMinor: 5000,
        balanceMinor: 0,
        dischargedAt: '2026-05-16T11:00:00.000Z',
        settledAt: '2026-05-16T11:00:00.000Z',
        version: 5,
      }),
    );
    expect(finalPaymentResponse.body.data.transition.transitionType).toBe(BillingTransitionType.SETTLEMENT_COMPLETED);

    const settledInvoiceResponse = await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(settledInvoiceResponse.status).toBe(200);
    expect(settledInvoiceResponse.body.data.lines).toHaveLength(1);
    expect(settledInvoiceResponse.body.data.payments).toHaveLength(2);
    expect(settledInvoiceResponse.body.data.transitions.map((entry: any) => entry.transitionType)).toEqual([
      BillingTransitionType.INVOICE_OPENED,
      BillingTransitionType.CHARGE_APPENDED,
      BillingTransitionType.PAYMENT_RECORDED,
      BillingTransitionType.DISCHARGE_SYNC,
      BillingTransitionType.SETTLEMENT_COMPLETED,
    ]);
  });

  it('rejects duplicate charge replay and stale invoice versions with deterministic 409 envelopes', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ patientId: patient.id });

    const admissionId = admitResponse.body.data.id as string;

    await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chargeCode: 'LAB_CBC',
        description: 'CBC panel',
        quantity: 1,
        unitAmountMinor: 1200,
        idempotencyKey: 'cbc-1',
        expectedInvoiceVersion: 1,
      })
      .expect(200);

    const duplicateReplayResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chargeCode: 'LAB_CBC',
        description: 'CBC panel duplicate attempt',
        quantity: 1,
        unitAmountMinor: 1200,
        idempotencyKey: 'cbc-1',
        expectedInvoiceVersion: 2,
      });

    expect(duplicateReplayResponse.status).toBe(409);
    expect(duplicateReplayResponse.body).toEqual({
      success: false,
      error: {
        code: 'BILLING_DUPLICATE_CHARGE_REPLAY',
        message: 'Charge replay already applied for this invoice',
      },
    });

    const staleVersionResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chargeCode: 'LAB_BMP',
        description: 'BMP panel',
        quantity: 1,
        unitAmountMinor: 1800,
        idempotencyKey: 'bmp-1',
        expectedInvoiceVersion: 1,
      });

    expect(staleVersionResponse.status).toBe(409);
    expect(staleVersionResponse.body).toEqual({
      success: false,
      error: {
        code: 'BILLING_INVOICE_VERSION_CONFLICT',
        message: 'Billing invoice version conflict',
      },
    });

    const invoice = Array.from(billingInvoiceStore.values())[0];
    expect(invoice.version).toBe(2);
    expect(Array.from(billingInvoiceLineStore.values())).toHaveLength(1);
  });

  it('rejects charge and payment mutations after the invoice is already settled', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ patientId: patient.id });

    const admissionId = admitResponse.body.data.id as string;

    await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .post(`/api/v1/ipd/admissions/${admissionId}/discharge`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expectedAdmissionVersion: 1,
        dischargedAt: '2026-05-16T13:00:00.000Z',
      })
      .expect(200);

    const chargeAfterSettlementResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        description: 'Late charge',
        quantity: 1,
        unitAmountMinor: 500,
        idempotencyKey: 'late-charge',
        expectedInvoiceVersion: 2,
      });

    expect(chargeAfterSettlementResponse.status).toBe(409);
    expect(chargeAfterSettlementResponse.body).toEqual({
      success: false,
      error: {
        code: 'BILLING_INVALID_SETTLEMENT_TRANSITION',
        message: 'Settled invoices do not accept further billing mutations',
      },
    });

    const paymentAfterSettlementResponse = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountMinor: 100,
        paymentMethod: 'cash',
        expectedInvoiceVersion: 2,
      });

    expect(paymentAfterSettlementResponse.status).toBe(409);
    expect(paymentAfterSettlementResponse.body).toEqual({
      success: false,
      error: {
        code: 'BILLING_INVALID_SETTLEMENT_TRANSITION',
        message: 'Settled invoices do not accept further billing mutations',
      },
    });
  });

  it('rejects doctor access before hitting billing persistence', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'doctor');

    const response = await request(app)
      .get('/api/v1/billing/admissions/admission_1/invoice')
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

  it('maps billing store outages to a deterministic unavailable envelope', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ patientId: patient.id });

    const admissionId = admitResponse.body.data.id as string;
    dbState.failNextBillingInvoiceRead = true;

    const response = await request(app)
      .get(`/api/v1/billing/admissions/${admissionId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'BILLING_UNAVAILABLE',
        message: 'Billing persistence is temporarily unavailable',
      },
    });
  });

  it('rejects malformed billing payloads with validation details', async () => {
    const app = createApp();
    const accessToken = await loginAs(app, 'reception');
    const patient = seedPatient();

    const admitResponse = await request(app)
      .post('/api/v1/ipd/admissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ patientId: patient.id });

    const admissionId = admitResponse.body.data.id as string;

    const response = await request(app)
      .post(`/api/v1/billing/admissions/${admissionId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        description: '',
        quantity: 0,
        unitAmountMinor: -1,
        idempotencyKey: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'description' }),
        expect.objectContaining({ path: 'quantity' }),
        expect.objectContaining({ path: 'unitAmountMinor' }),
        expect.objectContaining({ path: 'idempotencyKey' }),
      ]),
    );
  });
});
