import { BillingTransitionType, type Prisma } from '@prisma/client/index';

import { transitionSelect } from './billing.select.js';
import type {
  BillingInvoiceTransitionSnapshot,
  BillingTransitionRecord,
} from './billing.types.js';

export const createTransitionContext = (context: Prisma.InputJsonObject) =>
  context;

export const createTransition = async (
  tx: Prisma.TransactionClient,
  params: {
    invoiceId: string;
    actorUserId: string;
    transitionType: BillingTransitionType;
    previous: BillingInvoiceTransitionSnapshot;
    next: BillingInvoiceTransitionSnapshot;
    context: Prisma.InputJsonObject;
  },
) => {
  const transition = await tx.billingTransitionHistory.create({
    data: {
      invoiceId: params.invoiceId,
      actorUserId: params.actorUserId,
      transitionType: params.transitionType,
      fromPaymentStatus: params.previous.paymentStatus,
      toPaymentStatus: params.next.paymentStatus,
      fromSettlementStatus: params.previous.settlementStatus,
      toSettlementStatus: params.next.settlementStatus,
      balanceMinor: params.next.balanceMinor,
      context: params.context,
    },
    select: transitionSelect,
  });

  return transition as BillingTransitionRecord;
};

export const createInitialTransition = async (
  tx: Prisma.TransactionClient,
  params: {
    invoiceId: string;
    actorUserId: string;
    snapshot: BillingInvoiceTransitionSnapshot;
  },
) => {
  await tx.billingTransitionHistory.create({
    data: {
      invoiceId: params.invoiceId,
      actorUserId: params.actorUserId,
      transitionType: BillingTransitionType.INVOICE_OPENED,
      fromPaymentStatus: null,
      toPaymentStatus: params.snapshot.paymentStatus,
      fromSettlementStatus: null,
      toSettlementStatus: params.snapshot.settlementStatus,
      balanceMinor: params.snapshot.balanceMinor,
      context: createTransitionContext({
        trigger: 'invoice_opened',
      }),
    },
  });
};
