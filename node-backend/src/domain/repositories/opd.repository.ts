import { type Patient, type PatientGender, type User } from '@prisma/client';

import { db } from '../../infrastructure/database/client.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

export type CreatePatientRecordInput = {
  fullName: string;
  primaryPhone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: PatientGender;
  address?: string;
  createdByUserId: string;
};

const wrapOpdStoreError = (
  action: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): never => {
  if (error instanceof AppError) {
    throw error;
  }

  logger.error(
    {
      action,
      ...(metadata ?? {}),
      error,
    },
    'opd_repository_failed',
  );

  throw new AppError(
    'OPD persistence is temporarily unavailable',
    503,
    ERROR_CODES.opdUnavailable,
  );
};

class OpdRepository {
  async createPatient(data: CreatePatientRecordInput) {
    try {
      return await db.patient.create({
        data,
      });
    } catch (error) {
      return wrapOpdStoreError('create_patient', error, {
        actorUserId: data.createdByUserId,
      });
    }
  }

  async findPatientById(id: string) {
    try {
      return await db.patient.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapOpdStoreError('find_patient_by_id', error, {
        patientId: id,
      });
    }
  }

  async findUserById(id: string) {
    try {
      return await db.user.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapOpdStoreError('find_user_by_id', error, {
        userId: id,
      });
    }
  }
}

export const opdRepository = new OpdRepository();
export type OpdPatientRecord = Patient;
export type OpdUserRecord = User;
