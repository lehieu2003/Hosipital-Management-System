import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableTrimmedString = (max: number) => trimmedString(max).nullable().optional();
const entityId = trimmedString(191);
const isoDateTime = z.string().datetime({ offset: true });
const jsonRecord = z.record(z.string(), z.unknown());

export const billingAdmissionIdParamsSchema = z.object({
  admissionId: entityId,
});

export const appendBillingChargeSchema = z
  .object({
    chargeCode: trimmedString(120).nullable().optional(),
    description: trimmedString(255),
    quantity: z.number().int().positive(),
    unitAmountMinor: z.number().int().positive(),
    idempotencyKey: trimmedString(191),
    metadata: jsonRecord.nullable().optional(),
    expectedInvoiceVersion: z.number().int().positive().optional(),
  })
  .strict();

export const recordBillingPaymentSchema = z
  .object({
    amountMinor: z.number().int().positive(),
    paymentMethod: trimmedString(120),
    paymentReference: optionalNullableTrimmedString(191),
    note: optionalNullableTrimmedString(2000),
    receivedAt: isoDateTime.optional(),
    expectedInvoiceVersion: z.number().int().positive().optional(),
  })
  .strict();

export type BillingAdmissionIdParams = z.infer<typeof billingAdmissionIdParamsSchema>;
export type AppendBillingChargeBody = z.infer<typeof appendBillingChargeSchema>;
export type RecordBillingPaymentBody = z.infer<typeof recordBillingPaymentSchema>;
