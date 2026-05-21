import prismaClientPkg, { type Prisma, type BillingPaymentStatus as BillingPaymentStatusType, type BillingSettlementStatus as BillingSettlementStatusType } from '@prisma/client/index';

const { BillingPaymentStatus, BillingSettlementStatus } = prismaClientPkg;

import { invoiceSelect } from './billing.select.js';
import { createInitialTransition } from './billing.transitions.js';
import type { BillingInvoiceRecord } from './billing.types.js';

export const getInvoiceOrThrow = async (
  tx: Prisma.TransactionClient,
  invoiceId: string,
) => {
  const invoice = await tx.billingInvoice.findUnique({
    where: { id: invoiceId },
    select: invoiceSelect,
  });

  if (!invoice) {
    throw new Error(`Billing invoice ${invoiceId} disappeared before readback`);
  }

  return invoice as BillingInvoiceRecord;
};

export const ensureInvoiceForAdmissionTx = async (
  tx: Prisma.TransactionClient,
  {
    admissionId,
    actorUserId,
  }: {
    admissionId: string;
    actorUserId: string;
  },
) => {
  const existing = await tx.billingInvoice.findUnique({
    where: { admissionId },
    select: invoiceSelect,
  });

  if (existing) {
    return existing as BillingInvoiceRecord;
  }

  const admission = await tx.inpatientAdmission.findUnique({
    where: { id: admissionId },
    select: {
      id: true,
      patientId: true,
      dischargeAt: true,
    },
  });

  if (!admission) {
    return null;
  }

  const settlementStatus = admission.dischargeAt
    ? BillingSettlementStatus.SETTLED
    : BillingSettlementStatus.OPEN;

  const invoice = await tx.billingInvoice.create({
    data: {
      admissionId,
      patientId: admission.patientId,
      createdByUserId: actorUserId,
      dischargedAt: admission.dischargeAt,
      paymentStatus: BillingPaymentStatus.UNPAID,
      settlementStatus,
      balanceMinor: 0,
      settledAt: admission.dischargeAt,
    },
    select: {
      id: true,
    },
  });

  await createInitialTransition(tx, {
    invoiceId: invoice.id,
    actorUserId,
    snapshot: {
      paymentStatus: BillingPaymentStatus.UNPAID,
      settlementStatus,
      balanceMinor: 0,
      dischargedAt: admission.dischargeAt,
      settledAt: admission.dischargeAt,
    },
  });

  return getInvoiceOrThrow(tx, invoice.id);
};
