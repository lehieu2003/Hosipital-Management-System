import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableTrimmedString = (max: number) => trimmedString(max).nullable().optional();
const entityId = trimmedString(191);
const isoDateTime = z.string().datetime({ offset: true });

export const admissionIdParamsSchema = z.object({
  admissionId: entityId,
});

export const createAdmissionSchema = z
  .object({
    patientId: entityId,
    attendingDoctorUserId: entityId.optional(),
    admittedAt: isoDateTime.optional(),
    notes: optionalNullableTrimmedString(2000),
  })
  .strict();

export const assignBedSchema = z
  .object({
    bedId: entityId,
    expectedAdmissionVersion: z.number().int().positive(),
    note: optionalNullableTrimmedString(2000),
  })
  .strict();

export const transferBedSchema = z
  .object({
    targetBedId: entityId,
    expectedAdmissionVersion: z.number().int().positive(),
    expectedOccupancyVersion: z.number().int().positive(),
    note: optionalNullableTrimmedString(2000),
  })
  .strict();

export const dischargeAdmissionSchema = z
  .object({
    expectedAdmissionVersion: z.number().int().positive(),
    expectedOccupancyVersion: z.number().int().positive().optional(),
    dischargedAt: isoDateTime.optional(),
    dischargeNotes: optionalNullableTrimmedString(2000),
    movementNote: optionalNullableTrimmedString(2000),
  })
  .strict();

export type AdmissionIdParams = z.infer<typeof admissionIdParamsSchema>;
export type CreateAdmissionBody = z.infer<typeof createAdmissionSchema>;
export type AssignBedBody = z.infer<typeof assignBedSchema>;
export type TransferBedBody = z.infer<typeof transferBedSchema>;
export type DischargeAdmissionBody = z.infer<typeof dischargeAdmissionSchema>;
