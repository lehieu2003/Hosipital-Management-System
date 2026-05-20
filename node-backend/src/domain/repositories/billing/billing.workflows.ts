import {
  BillingInvoiceLineType,
  BillingSettlementStatus,
  BillingTransitionType,
  type Prisma,
} from '@prisma/client';

import { db } from '../../../infrastructure/database/client.js';
import { wrapBillingStoreError } from './billing.errors.js';
import {
  ensureInvoiceForAdmissionTx,
  getInvoiceOrThrow,
} from './billing.invoice-access.js';
import { paymentSelect, invoiceLineSelect, replaySelect } from './billing.select.js';
import {
  buildInvoiceSnapshot,
  computePaymentStatus,
  computeSettlementState,
  requireMutableInvoiceState,
} from './billing.state.js';
import {
  createTransition,
  createTransitionContext,
} from './billing.transitions.js';
import type {
  AppendChargeRecordInput,
  AppendChargeWriteResult,
  BillingChargeReplayRecord,
  BillingInvoiceLineRecord,
  BillingPaymentRecord,
  RecordPaymentInput,
  RecordPaymentWriteResult,
  SyncDischargeSettlementInput,
  SyncDischargeSettlementWriteResult,
} from './billing.types.js';

export const syncBillingSettlementForDischargeTx = async (
  tx: Prisma.TransactionClient,
  input: SyncDischargeSettlementInput,
): Promise<SyncDischargeSettlementWriteResult> => {
  const invoice = await ensureInvoiceForAdmissionTx(tx, {
    admissionId: input.admissionId,
    actorUserId: input.actorUserId,
  });

  if (!invoice) {
    return {
      ok: false,
      reason: 'admission_not_found',
    };
  }

  if (
    input.expectedInvoiceVersion !== undefined &&
    invoice.version !== input.expectedInvoiceVersion
  ) {
    return {
      ok: false,
      reason: 'stale_invoice_version',
      invoice,
    };
  }

  requireMutableInvoiceState(buildInvoiceSnapshot(invoice), 'sync_discharge');

  const previous = buildInvoiceSnapshot(invoice);
  const nextSettlement = computeSettlementState({
    dischargedAt: input.dischargedAt,
    balanceMinor: invoice.balanceMinor,
  });

  const updatedInvoiceRow = await tx.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      dischargedAt: input.dischargedAt,
      settlementStatus: nextSettlement.settlementStatus,
      settledAt: nextSettlement.settledAt,
      version: { increment: 1 },
    },
    select: {
      id: true,
    },
  });

  const updatedInvoice = await getInvoiceOrThrow(tx, updatedInvoiceRow.id);
  const next = buildInvoiceSnapshot(updatedInvoice);
  const transition = await createTransition(tx, {
    invoiceId: updatedInvoice.id,
    actorUserId: input.actorUserId,
    transitionType:
      next.settlementStatus === BillingSettlementStatus.SETTLED
        ? BillingTransitionType.SETTLEMENT_COMPLETED
        : BillingTransitionType.DISCHARGE_SYNC,
    previous,
    next,
    context: createTransitionContext({
      trigger: 'discharge_sync',
      dischargedAt: input.dischargedAt.toISOString(),
      admissionId: input.admissionId,
    }),
  });

  return {
    ok: true,
    invoice: updatedInvoice,
    transition,
  };
};

export class BillingWorkflows {
  async appendCharge(
    input: AppendChargeRecordInput,
  ): Promise<AppendChargeWriteResult> {
    try {
      return await db.$transaction(async (tx) => {
        const invoice = await ensureInvoiceForAdmissionTx(tx, {
          admissionId: input.admissionId,
          actorUserId: input.actorUserId,
        });

        if (!invoice) {
          return {
            ok: false,
            reason: 'admission_not_found',
          };
        }

        if (
          input.expectedInvoiceVersion !== undefined &&
          invoice.version !== input.expectedInvoiceVersion
        ) {
          return {
            ok: false,
            reason: 'stale_invoice_version',
            invoice,
          };
        }

        requireMutableInvoiceState(buildInvoiceSnapshot(invoice), 'append_charge');

        const replay = await tx.billingChargeIdempotency.findUnique({
          where: {
            invoiceId_idempotencyKey: {
              invoiceId: invoice.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: replaySelect,
        });

        if (replay) {
          return {
            ok: false,
            reason: 'duplicate_charge_replay',
            replay: replay as BillingChargeReplayRecord,
            invoice,
          };
        }

        const previous = buildInvoiceSnapshot(invoice);
        const lineAmountMinor = input.quantity * input.unitAmountMinor;

        const line = await tx.billingInvoiceLine.create({
          data: {
            invoiceId: invoice.id,
            lineType: BillingInvoiceLineType.CHARGE,
            chargeCode: input.chargeCode,
            description: input.description,
            quantity: input.quantity,
            unitAmountMinor: input.unitAmountMinor,
            lineAmountMinor,
            metadata: input.metadata,
            createdByUserId: input.actorUserId,
          },
          select: invoiceLineSelect,
        });

        await tx.billingChargeIdempotency.create({
          data: {
            invoiceId: invoice.id,
            lineId: line.id,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            createdByUserId: input.actorUserId,
          },
        });

        const totalChargesMinor = invoice.totalChargesMinor + lineAmountMinor;
        const totalPaymentsMinor = invoice.totalPaymentsMinor;
        const balanceMinor = totalChargesMinor - totalPaymentsMinor;
        const paymentStatus = computePaymentStatus(
          totalChargesMinor,
          totalPaymentsMinor,
        );
        const nextSettlement = computeSettlementState({
          dischargedAt: invoice.dischargedAt,
          balanceMinor,
        });

        const updatedInvoiceRow = await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            totalChargesMinor,
            balanceMinor,
            paymentStatus,
            settlementStatus: nextSettlement.settlementStatus,
            settledAt: nextSettlement.settledAt,
            version: { increment: 1 },
          },
          select: {
            id: true,
          },
        });

        const updatedInvoice = await getInvoiceOrThrow(tx, updatedInvoiceRow.id);
        const next = buildInvoiceSnapshot(updatedInvoice);
        const transition = await createTransition(tx, {
          invoiceId: updatedInvoice.id,
          actorUserId: input.actorUserId,
          transitionType: BillingTransitionType.CHARGE_APPENDED,
          previous,
          next,
          context: createTransitionContext({
            trigger: 'charge_appended',
            chargeCode: input.chargeCode ?? null,
            description: input.description,
            quantity: input.quantity,
            unitAmountMinor: input.unitAmountMinor,
            lineAmountMinor,
            idempotencyKey: input.idempotencyKey,
          }),
        });

        return {
          ok: true,
          invoice: updatedInvoice,
          line: line as BillingInvoiceLineRecord,
          transition,
        };
      });
    } catch (error) {
      return wrapBillingStoreError('append_charge', error, {
        admissionId: input.admissionId,
        idempotencyKey: input.idempotencyKey,
        actorUserId: input.actorUserId,
      });
    }
  }

  async recordPayment(
    input: RecordPaymentInput,
  ): Promise<RecordPaymentWriteResult> {
    try {
      return await db.$transaction(async (tx) => {
        const invoice = await ensureInvoiceForAdmissionTx(tx, {
          admissionId: input.admissionId,
          actorUserId: input.actorUserId,
        });

        if (!invoice) {
          return {
            ok: false,
            reason: 'admission_not_found',
          };
        }

        if (
          input.expectedInvoiceVersion !== undefined &&
          invoice.version !== input.expectedInvoiceVersion
        ) {
          return {
            ok: false,
            reason: 'stale_invoice_version',
            invoice,
          };
        }

        requireMutableInvoiceState(buildInvoiceSnapshot(invoice), 'record_payment');

        const previous = buildInvoiceSnapshot(invoice);
        const payment = await tx.billingPayment.create({
          data: {
            invoiceId: invoice.id,
            amountMinor: input.amountMinor,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference,
            note: input.note,
            recordedByUserId: input.actorUserId,
            receivedAt: input.receivedAt,
          },
          select: paymentSelect,
        });

        const totalChargesMinor = invoice.totalChargesMinor;
        const totalPaymentsMinor = invoice.totalPaymentsMinor + input.amountMinor;
        const balanceMinor = totalChargesMinor - totalPaymentsMinor;
        const paymentStatus = computePaymentStatus(
          totalChargesMinor,
          totalPaymentsMinor,
        );
        const nextSettlement = computeSettlementState({
          dischargedAt: invoice.dischargedAt,
          balanceMinor,
        });

        const updatedInvoiceRow = await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            totalPaymentsMinor,
            balanceMinor,
            paymentStatus,
            settlementStatus: nextSettlement.settlementStatus,
            settledAt: nextSettlement.settledAt,
            version: { increment: 1 },
          },
          select: {
            id: true,
          },
        });

        const updatedInvoice = await getInvoiceOrThrow(tx, updatedInvoiceRow.id);
        const next = buildInvoiceSnapshot(updatedInvoice);
        const transition = await createTransition(tx, {
          invoiceId: updatedInvoice.id,
          actorUserId: input.actorUserId,
          transitionType:
            next.settlementStatus === BillingSettlementStatus.SETTLED
              ? BillingTransitionType.SETTLEMENT_COMPLETED
              : BillingTransitionType.PAYMENT_RECORDED,
          previous,
          next,
          context: createTransitionContext({
            trigger: 'payment_recorded',
            amountMinor: input.amountMinor,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference ?? null,
            receivedAt: payment.receivedAt.toISOString(),
          }),
        });

        return {
          ok: true,
          invoice: updatedInvoice,
          payment: payment as BillingPaymentRecord,
          transition,
        };
      });
    } catch (error) {
      return wrapBillingStoreError('record_payment', error, {
        admissionId: input.admissionId,
        actorUserId: input.actorUserId,
        amountMinor: input.amountMinor,
      });
    }
  }

  async syncSettlementForDischarge(
    input: SyncDischargeSettlementInput,
  ): Promise<SyncDischargeSettlementWriteResult> {
    try {
      return await db.$transaction((tx) =>
        syncBillingSettlementForDischargeTx(tx, input),
      );
    } catch (error) {
      return wrapBillingStoreError('sync_settlement_for_discharge', error, {
        admissionId: input.admissionId,
        actorUserId: input.actorUserId,
        dischargedAt: input.dischargedAt.toISOString(),
      });
    }
  }
}
