import prismaClientPkg, { type BillingChargeIdempotency, type BillingInvoice, type BillingInvoiceLine, type BillingPayment, type BillingTransitionHistory, type Patient, type Prisma, type User, type BillingPaymentStatus as BillingPaymentStatusType, type BillingSettlementStatus as BillingSettlementStatusType } from '@prisma/client/index';

const { BillingPaymentStatus, BillingSettlementStatus } = prismaClientPkg;

export type BillingActorRecord = Pick<
  User,
  'id' | 'username' | 'role' | 'isActive'
>;
export type BillingPatientRecord = Pick<
  Patient,
  'id' | 'registrationNumber' | 'fullName' | 'primaryPhone'
>;

export type BillingInvoiceLineRecord = Pick<
  BillingInvoiceLine,
  | 'id'
  | 'invoiceId'
  | 'lineType'
  | 'chargeCode'
  | 'description'
  | 'quantity'
  | 'unitAmountMinor'
  | 'lineAmountMinor'
  | 'metadata'
  | 'createdByUserId'
  | 'createdAt'
> & {
  createdByUser: BillingActorRecord | null;
};

export type BillingPaymentRecord = Pick<
  BillingPayment,
  | 'id'
  | 'invoiceId'
  | 'amountMinor'
  | 'paymentMethod'
  | 'paymentReference'
  | 'note'
  | 'recordedByUserId'
  | 'receivedAt'
  | 'createdAt'
> & {
  recordedByUser: BillingActorRecord | null;
};

export type BillingTransitionRecord = Pick<
  BillingTransitionHistory,
  | 'id'
  | 'invoiceId'
  | 'transitionType'
  | 'fromPaymentStatus'
  | 'toPaymentStatus'
  | 'fromSettlementStatus'
  | 'toSettlementStatus'
  | 'balanceMinor'
  | 'context'
  | 'actorUserId'
  | 'createdAt'
> & {
  actorUser: BillingActorRecord | null;
};

export type BillingChargeReplayRecord = Pick<
  BillingChargeIdempotency,
  | 'id'
  | 'invoiceId'
  | 'lineId'
  | 'idempotencyKey'
  | 'requestHash'
  | 'createdByUserId'
  | 'createdAt'
> & {
  createdByUser: BillingActorRecord | null;
  line: BillingInvoiceLineRecord;
};

export type BillingInvoiceRecord = Pick<
  BillingInvoice,
  | 'id'
  | 'admissionId'
  | 'patientId'
  | 'paymentStatus'
  | 'settlementStatus'
  | 'currency'
  | 'totalChargesMinor'
  | 'totalPaymentsMinor'
  | 'balanceMinor'
  | 'dischargedAt'
  | 'settledAt'
  | 'version'
  | 'createdByUserId'
  | 'createdAt'
  | 'updatedAt'
> & {
  patient: BillingPatientRecord;
  createdByUser: BillingActorRecord | null;
  lines: BillingInvoiceLineRecord[];
  payments: BillingPaymentRecord[];
  transitions: BillingTransitionRecord[];
};

export type BillingInvoiceTransitionSnapshot = {
  paymentStatus: BillingPaymentStatusType;
  settlementStatus: BillingSettlementStatusType;
  balanceMinor: number;
  dischargedAt: Date | null;
  settledAt: Date | null;
};

export type AppendChargeRecordInput = {
  admissionId: string;
  chargeCode?: string | null;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  idempotencyKey: string;
  requestHash: string;
  actorUserId: string;
  metadata?: Prisma.InputJsonValue;
  expectedInvoiceVersion?: number;
};

export type RecordPaymentInput = {
  admissionId: string;
  amountMinor: number;
  paymentMethod: string;
  paymentReference?: string | null;
  note?: string | null;
  receivedAt?: Date;
  actorUserId: string;
  expectedInvoiceVersion?: number;
};

export type SyncDischargeSettlementInput = {
  admissionId: string;
  actorUserId: string;
  dischargedAt: Date;
  expectedInvoiceVersion?: number;
};

export type AppendChargeWriteResult =
  | {
      ok: true;
      invoice: BillingInvoiceRecord;
      line: BillingInvoiceLineRecord;
      transition: BillingTransitionRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'stale_invoice_version'
        | 'invalid_settlement_transition'
        | 'duplicate_charge_replay';
      replay?: BillingChargeReplayRecord;
      invoice?: BillingInvoiceRecord;
    };

export type RecordPaymentWriteResult =
  | {
      ok: true;
      invoice: BillingInvoiceRecord;
      payment: BillingPaymentRecord;
      transition: BillingTransitionRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'stale_invoice_version'
        | 'invalid_settlement_transition';
      invoice?: BillingInvoiceRecord;
    };

export type SyncDischargeSettlementWriteResult =
  | {
      ok: true;
      invoice: BillingInvoiceRecord;
      transition: BillingTransitionRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'stale_invoice_version'
        | 'invalid_settlement_transition';
      invoice?: BillingInvoiceRecord;
    };
