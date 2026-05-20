import type { Response } from 'express';

import { billingService } from '../../domain/services/billing.service.js';
import type {
  BillingActorRecord,
  BillingInvoiceLineRecord,
  BillingInvoiceRecord,
  BillingPaymentRecord,
  BillingTransitionRecord,
} from '../../domain/repositories/billing.repository.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  appendBillingChargeSchema,
  billingAdmissionIdParamsSchema,
  recordBillingPaymentSchema,
} from '../validators/billing.validator.js';

const serializeActor = (actor: BillingActorRecord | null) =>
  actor
    ? {
        id: actor.id,
        username: actor.username,
        role: actor.role,
        isActive: actor.isActive,
      }
    : null;

const serializeInvoiceLine = (line: BillingInvoiceLineRecord) => ({
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
  createdAt: line.createdAt.toISOString(),
  createdByUser: serializeActor(line.createdByUser),
});

const serializePayment = (payment: BillingPaymentRecord) => ({
  id: payment.id,
  invoiceId: payment.invoiceId,
  amountMinor: payment.amountMinor,
  paymentMethod: payment.paymentMethod,
  paymentReference: payment.paymentReference ?? null,
  note: payment.note ?? null,
  recordedByUserId: payment.recordedByUserId ?? null,
  receivedAt: payment.receivedAt.toISOString(),
  createdAt: payment.createdAt.toISOString(),
  recordedByUser: serializeActor(payment.recordedByUser),
});

const serializeTransition = (transition: BillingTransitionRecord) => ({
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
  createdAt: transition.createdAt.toISOString(),
  actorUser: serializeActor(transition.actorUser),
});

const serializeInvoice = (invoice: BillingInvoiceRecord) => ({
  id: invoice.id,
  admissionId: invoice.admissionId,
  patientId: invoice.patientId,
  paymentStatus: invoice.paymentStatus,
  settlementStatus: invoice.settlementStatus,
  currency: invoice.currency,
  totalChargesMinor: invoice.totalChargesMinor,
  totalPaymentsMinor: invoice.totalPaymentsMinor,
  balanceMinor: invoice.balanceMinor,
  dischargedAt: invoice.dischargedAt?.toISOString() ?? null,
  settledAt: invoice.settledAt?.toISOString() ?? null,
  version: invoice.version,
  createdByUserId: invoice.createdByUserId ?? null,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  patient: {
    id: invoice.patient.id,
    registrationNumber: invoice.patient.registrationNumber,
    fullName: invoice.patient.fullName,
    primaryPhone: invoice.patient.primaryPhone,
  },
  createdByUser: serializeActor(invoice.createdByUser),
  lines: invoice.lines.map(serializeInvoiceLine),
  payments: invoice.payments.map(serializePayment),
  transitions: invoice.transitions.map(serializeTransition),
});

const requirePrincipal = (req: AuthenticatedRequest) => {
  if (!req.auth) {
    throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
  }

  return req.auth;
};

export const getBillingInvoiceController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = billingAdmissionIdParamsSchema.parse(req.params);
  const invoice = await billingService.getInvoiceByAdmissionId(params.admissionId, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: serializeInvoice(invoice),
  });
});

export const appendBillingChargeController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = billingAdmissionIdParamsSchema.parse(req.params);
  const payload = appendBillingChargeSchema.parse(req.body);
  const result = await billingService.appendCharge(params.admissionId, payload, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: {
      invoice: serializeInvoice(result.invoice),
      line: serializeInvoiceLine(result.line),
      transition: serializeTransition(result.transition),
    },
  });
});

export const recordBillingPaymentController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = billingAdmissionIdParamsSchema.parse(req.params);
  const payload = recordBillingPaymentSchema.parse(req.body);
  const result = await billingService.recordPayment(params.admissionId, payload, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: {
      invoice: serializeInvoice(result.invoice),
      payment: serializePayment(result.payment),
      transition: serializeTransition(result.transition),
    },
  });
});
