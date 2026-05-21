import prismaClientPkg, { type BillingPaymentStatus as BillingPaymentStatusType, type BillingSettlementStatus as BillingSettlementStatusType } from '@prisma/client/index';

const { BillingPaymentStatus, BillingSettlementStatus } = prismaClientPkg;

import { ERROR_CODES } from '../../../shared/constants/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { BillingInvoiceTransitionSnapshot } from './billing.types.js';

export const computePaymentStatus = (
  totalChargesMinor: number,
  totalPaymentsMinor: number,
) => {
  if (totalPaymentsMinor <= 0) {
    return BillingPaymentStatus.UNPAID;
  }

  if (totalPaymentsMinor < totalChargesMinor) {
    return BillingPaymentStatus.PARTIALLY_PAID;
  }

  return BillingPaymentStatus.PAID_IN_FULL;
};

export const computeSettlementState = ({
  dischargedAt,
  balanceMinor,
}: {
  dischargedAt: Date | null;
  balanceMinor: number;
}) => {
  if (!dischargedAt) {
    return {
      settlementStatus: BillingSettlementStatus.OPEN,
      settledAt: null,
    };
  }

  if (balanceMinor <= 0) {
    return {
      settlementStatus: BillingSettlementStatus.SETTLED,
      settledAt: dischargedAt,
    };
  }

  return {
    settlementStatus: BillingSettlementStatus.PENDING_SETTLEMENT,
    settledAt: null,
  };
};

export const buildInvoiceSnapshot = (invoice: {
  paymentStatus: BillingPaymentStatusType;
  settlementStatus: BillingSettlementStatusType;
  balanceMinor: number;
  dischargedAt: Date | null;
  settledAt: Date | null;
}): BillingInvoiceTransitionSnapshot => ({
  paymentStatus: invoice.paymentStatus,
  settlementStatus: invoice.settlementStatus,
  balanceMinor: invoice.balanceMinor,
  dischargedAt: invoice.dischargedAt,
  settledAt: invoice.settledAt,
});

export const requireMutableInvoiceState = (
  invoice: BillingInvoiceTransitionSnapshot,
  action: 'append_charge' | 'record_payment' | 'sync_discharge',
) => {
  if (
    action !== 'sync_discharge' &&
    invoice.settlementStatus === BillingSettlementStatus.SETTLED
  ) {
    throw new AppError(
      'Settled invoices do not accept further billing mutations',
      409,
      ERROR_CODES.billingInvalidSettlementTransition,
    );
  }
};
