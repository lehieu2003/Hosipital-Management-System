import { PatientGender } from '@prisma/client';
import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max: number) => trimmedString(max).optional();

export const createPatientSchema = z.object({
  fullName: trimmedString(255),
  primaryPhone: trimmedString(32),
  email: trimmedString(255).email().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  address: optionalTrimmedString(500),
});

export type CreatePatientBody = z.infer<typeof createPatientSchema>;
