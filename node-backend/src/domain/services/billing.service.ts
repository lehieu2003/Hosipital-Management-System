import { createHash } from 'node:crypto';

import { UserRole, type Prisma } from '@prisma/client';

import type { AuthPrincipal } from '../../app/middlewares/auth.middleware.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import { billingRepository } from '../repositories/billing.repository.js';

export type AppendBillingChargeInput = {
  chargeCode?: string | null;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  expectedInvoiceVersion?: number;
};

export type RecordBillingPaymentInput = {
  amountMinor: number;
  paymentMethod: string;
  paymentReference?: string | null;
  note?: string | null;
  receivedAt?: string;
  expectedInvoiceVersion?: number;
};

export type SyncBillingDischargeInput = {
  dischargedAt: string;
  expectedInvoiceVersion?: number;
};

const ensureBillingOperatorActor = (actor: AuthPrincipal) => {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.RECEPTIONIST) {
    return;
  }

  logger.warn(
    {
      actorRole: actor.role,
      actorUserId: actor.userId,
    },
    'billing_operator_role_denied',
  );

  throw new AppError(
    'Role is not permitted for this resource',
    HTTP_STATUS.forbidden,
    ERROR_CODES.forbidden,
  );
};

const ensurePositiveInteger = (
  value: number,
  {
    field,
    message,
    errorCode = ERROR_CODES.validationError,
  }: { field: string; message: string; errorCode?: string },
) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(`${field} ${message}`, HTTP_STATUS.badRequest, errorCode);
  }
};

const normalizeOptionalTrimmedString = (value?: string | null) => {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
};

const normalizeRequiredTrimmedString = (
  value: string,
  { field, errorCode = ERROR_CODES.validationError }: { field: string; errorCode?: string },
) => {
  const nextValue = value.trim();
  if (!nextValue) {
    throw new AppError(`${field} is required`, HTTP_STATUS.badRequest, errorCode);
  }

  return nextValue;
};

const normalizeIsoTimestamp = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('receivedAt must be a valid ISO-8601 timestamp', HTTP_STATUS.badRequest, ERROR_CODES.validationError);
  }

  return parsed;
};

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`;
};

const buildChargeRequestHash = (payload: {
  admissionId: string;
  chargeCode: string | null;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  metadata: Record<string, unknown> | null;
}) =>
  createHash('sha256')
    .update(stableSerialize(payload))
    .digest('hex');

class BillingService {
  async getInvoiceByAdmissionId(admissionId: string, actor: AuthPrincipal) {
    ensureBillingOperatorActor(actor);

    const invoice = await billingRepository.ensureInvoiceByAdmissionId(admissionId, actor.userId);
    if (!invoice) {
      throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
    }

    logger.info(
      {
        actorRole: actor.role,
        actorUserId: actor.userId,
        admissionId,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        paymentStatus: invoice.paymentStatus,
        settlementStatus: invoice.settlementStatus,
        balanceMinor: invoice.balanceMinor,
        version: invoice.version,
      },
      'billing_invoice_read',
    );

    return invoice;
  }

  async appendCharge(admissionId: string, input: AppendBillingChargeInput, actor: AuthPrincipal) {
    ensureBillingOperatorActor(actor);

    const description = normalizeRequiredTrimmedString(input.description, {
      field: 'description',
    });
    const chargeCode = normalizeOptionalTrimmedString(input.chargeCode);
    const idempotencyKey = normalizeRequiredTrimmedString(input.idempotencyKey, {
      field: 'idempotencyKey',
    });

    ensurePositiveInteger(input.quantity, {
      field: 'quantity',
      message: 'must be a positive integer',
    });
    ensurePositiveInteger(input.unitAmountMinor, {
      field: 'unitAmountMinor',
      message: 'must be a positive integer',
    });

    const metadata = input.metadata ?? null;
    const requestHash = buildChargeRequestHash({
      admissionId,
      chargeCode,
      description,
      quantity: input.quantity,
      unitAmountMinor: input.unitAmountMinor,
      metadata,
    });

    const result = await billingRepository.appendCharge({
      admissionId,
      chargeCode,
      description,
      quantity: input.quantity,
      unitAmountMinor: input.unitAmountMinor,
      idempotencyKey,
      requestHash,
      actorUserId: actor.userId,
      metadata: metadata === null ? undefined : (metadata as Prisma.InputJsonObject),
      expectedInvoiceVersion: input.expectedInvoiceVersion,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'admission_not_found':
          throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
        case 'stale_invoice_version':
          throw new AppError(
            'Billing invoice version conflict',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvoiceVersionConflict,
          );
        case 'invalid_settlement_transition':
          throw new AppError(
            'Billing invoice cannot accept this settlement transition',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvalidSettlementTransition,
          );
        case 'duplicate_charge_replay': {
          logger.warn(
            {
              actorRole: actor.role,
              actorUserId: actor.userId,
              admissionId,
              invoiceId: result.invoice?.id ?? result.replay?.invoiceId ?? null,
              duplicateLineId: result.replay?.lineId ?? null,
              idempotencyKey,
              requestHash,
              replayRequestHash: result.replay?.requestHash ?? null,
              replayMatchesRequest: result.replay?.requestHash === requestHash,
            },
            'billing_charge_replay_denied',
          );

          throw new AppError(
            'Charge replay already applied for this invoice',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingDuplicateChargeReplay,
          );
        }
      }
    }

    logger.info(
      {
        actorRole: actor.role,
        actorUserId: actor.userId,
        admissionId,
        invoiceId: result.invoice.id,
        invoiceVersion: result.invoice.version,
        lineId: result.line.id,
        chargeCode,
        idempotencyKey,
        transitionId: result.transition.id,
        paymentStatus: result.invoice.paymentStatus,
        settlementStatus: result.invoice.settlementStatus,
        balanceMinor: result.invoice.balanceMinor,
      },
      'billing_charge_appended',
    );

    return result;
  }

  async recordPayment(admissionId: string, input: RecordBillingPaymentInput, actor: AuthPrincipal) {
    ensureBillingOperatorActor(actor);

    ensurePositiveInteger(input.amountMinor, {
      field: 'amountMinor',
      message: 'must be a positive integer',
      errorCode: ERROR_CODES.billingPaymentAmountInvalid,
    });

    const paymentMethod = normalizeRequiredTrimmedString(input.paymentMethod, {
      field: 'paymentMethod',
    });

    const result = await billingRepository.recordPayment({
      admissionId,
      amountMinor: input.amountMinor,
      paymentMethod,
      paymentReference: normalizeOptionalTrimmedString(input.paymentReference),
      note: normalizeOptionalTrimmedString(input.note),
      receivedAt: normalizeIsoTimestamp(input.receivedAt),
      actorUserId: actor.userId,
      expectedInvoiceVersion: input.expectedInvoiceVersion,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'admission_not_found':
          throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
        case 'stale_invoice_version':
          throw new AppError(
            'Billing invoice version conflict',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvoiceVersionConflict,
          );
        case 'invalid_settlement_transition':
          throw new AppError(
            'Billing invoice cannot accept this settlement transition',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvalidSettlementTransition,
          );
      }
    }

    logger.info(
      {
        actorRole: actor.role,
        actorUserId: actor.userId,
        admissionId,
        invoiceId: result.invoice.id,
        invoiceVersion: result.invoice.version,
        paymentId: result.payment.id,
        paymentMethod,
        amountMinor: input.amountMinor,
        transitionId: result.transition.id,
        paymentStatus: result.invoice.paymentStatus,
        settlementStatus: result.invoice.settlementStatus,
        balanceMinor: result.invoice.balanceMinor,
      },
      'billing_payment_recorded',
    );

    return result;
  }

  async syncSettlementForDischarge(admissionId: string, input: SyncBillingDischargeInput, actor: AuthPrincipal) {
    ensureBillingOperatorActor(actor);

    const dischargedAt = normalizeIsoTimestamp(input.dischargedAt);
    if (!dischargedAt) {
      throw new AppError('dischargedAt is required', HTTP_STATUS.badRequest, ERROR_CODES.validationError);
    }

    const result = await billingRepository.syncSettlementForDischarge({
      admissionId,
      dischargedAt,
      actorUserId: actor.userId,
      expectedInvoiceVersion: input.expectedInvoiceVersion,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'admission_not_found':
          throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
        case 'stale_invoice_version':
          throw new AppError(
            'Billing invoice version conflict',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvoiceVersionConflict,
          );
        case 'invalid_settlement_transition':
          throw new AppError(
            'Billing invoice cannot accept this settlement transition',
            HTTP_STATUS.conflict,
            ERROR_CODES.billingInvalidSettlementTransition,
          );
      }
    }

    logger.info(
      {
        actorRole: actor.role,
        actorUserId: actor.userId,
        admissionId,
        invoiceId: result.invoice.id,
        invoiceVersion: result.invoice.version,
        transitionId: result.transition.id,
        paymentStatus: result.invoice.paymentStatus,
        settlementStatus: result.invoice.settlementStatus,
        balanceMinor: result.invoice.balanceMinor,
        dischargedAt: result.invoice.dischargedAt?.toISOString() ?? null,
        settledAt: result.invoice.settledAt?.toISOString() ?? null,
      },
      'billing_discharge_settlement_synced',
    );

    return result;
  }
}

export const billingService = new BillingService();
