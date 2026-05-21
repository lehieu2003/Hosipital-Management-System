import type { Prisma } from '@prisma/client/index';

const invoiceLineOrderBy: Prisma.BillingInvoiceLineOrderByWithRelationInput[] =
  [{ createdAt: 'asc' }, { id: 'asc' }];
const paymentOrderBy: Prisma.BillingPaymentOrderByWithRelationInput[] = [
  { receivedAt: 'asc' },
  { id: 'asc' },
];
const transitionOrderBy: Prisma.BillingTransitionHistoryOrderByWithRelationInput[] =
  [{ createdAt: 'asc' }, { id: 'asc' }];

export const actorSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
} as const;

export const patientSelect = {
  id: true,
  registrationNumber: true,
  fullName: true,
  primaryPhone: true,
} as const;

export const invoiceLineSelect = {
  id: true,
  invoiceId: true,
  lineType: true,
  chargeCode: true,
  description: true,
  quantity: true,
  unitAmountMinor: true,
  lineAmountMinor: true,
  metadata: true,
  createdByUserId: true,
  createdAt: true,
  createdByUser: {
    select: actorSelect,
  },
} as const;

export const paymentSelect = {
  id: true,
  invoiceId: true,
  amountMinor: true,
  paymentMethod: true,
  paymentReference: true,
  note: true,
  recordedByUserId: true,
  receivedAt: true,
  createdAt: true,
  recordedByUser: {
    select: actorSelect,
  },
} as const;

export const transitionSelect = {
  id: true,
  invoiceId: true,
  transitionType: true,
  fromPaymentStatus: true,
  toPaymentStatus: true,
  fromSettlementStatus: true,
  toSettlementStatus: true,
  balanceMinor: true,
  context: true,
  actorUserId: true,
  createdAt: true,
  actorUser: {
    select: actorSelect,
  },
} as const;

export const invoiceSelect = {
  id: true,
  admissionId: true,
  patientId: true,
  paymentStatus: true,
  settlementStatus: true,
  currency: true,
  totalChargesMinor: true,
  totalPaymentsMinor: true,
  balanceMinor: true,
  dischargedAt: true,
  settledAt: true,
  version: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: patientSelect,
  },
  createdByUser: {
    select: actorSelect,
  },
  lines: {
    orderBy: invoiceLineOrderBy,
    select: invoiceLineSelect,
  },
  payments: {
    orderBy: paymentOrderBy,
    select: paymentSelect,
  },
  transitions: {
    orderBy: transitionOrderBy,
    select: transitionSelect,
  },
} satisfies Prisma.BillingInvoiceSelect;

export const replaySelect = {
  id: true,
  invoiceId: true,
  lineId: true,
  idempotencyKey: true,
  requestHash: true,
  createdByUserId: true,
  createdAt: true,
  createdByUser: {
    select: actorSelect,
  },
  line: {
    select: invoiceLineSelect,
  },
} as const;
