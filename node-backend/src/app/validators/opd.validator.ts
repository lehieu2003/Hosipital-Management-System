import { AppointmentStatus, PatientGender } from '@prisma/client';
import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max: number) => trimmedString(max).optional();
const optionalNullableTrimmedString = (max: number) => trimmedString(max).nullable().optional();
const entityId = trimmedString(191);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTime = z.string().datetime({ offset: true });

export const createPatientSchema = z.object({
  fullName: trimmedString(255),
  primaryPhone: trimmedString(32),
  email: trimmedString(255).email().optional(),
  dateOfBirth: isoDate.optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  address: optionalTrimmedString(500),
});

export const appointmentIdParamsSchema = z.object({
  appointmentId: entityId,
});

export const createAppointmentSchema = z.object({
  patientId: entityId,
  doctorUserId: entityId,
  scheduledAt: isoDateTime,
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  notes: optionalNullableTrimmedString(2000),
});

export const updateAppointmentSchema = z
  .object({
    version: z.number().int().positive(),
    doctorUserId: entityId.optional(),
    scheduledAt: isoDateTime.optional(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    notes: optionalNullableTrimmedString(2000),
  })
  .refine(
    (value) =>
      value.doctorUserId !== undefined ||
      value.scheduledAt !== undefined ||
      value.durationMinutes !== undefined ||
      value.status !== undefined ||
      value.notes !== undefined,
    {
      message: 'At least one appointment field must be provided for update',
      path: ['version'],
    },
  );

export const updateDoctorQueueAppointmentSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum([AppointmentStatus.CHECKED_IN, AppointmentStatus.COMPLETED]),
  })
  .strict();

export type CreatePatientBody = z.infer<typeof createPatientSchema>;
export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentSchema>;
export type UpdateDoctorQueueAppointmentBody = z.infer<typeof updateDoctorQueueAppointmentSchema>;
export type AppointmentIdParams = z.infer<typeof appointmentIdParamsSchema>;
