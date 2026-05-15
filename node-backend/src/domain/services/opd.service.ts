import { UserRole, type PatientGender } from '@prisma/client';

import type { AuthPrincipal } from '../../app/middlewares/auth.middleware.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import { opdRepository } from '../repositories/opd.repository.js';

export type CreatePatientInput = {
  fullName: string;
  primaryPhone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: PatientGender;
  address?: string;
};

const normalizeDateOfBirth = (dateOfBirth?: string) => {
  if (!dateOfBirth) {
    return undefined;
  }

  return new Date(`${dateOfBirth}T00:00:00.000Z`);
};

class OpdService {
  async createPatient(input: CreatePatientInput, actor: AuthPrincipal) {
    try {
      const patient = await opdRepository.createPatient({
        fullName: input.fullName,
        primaryPhone: input.primaryPhone,
        email: input.email,
        dateOfBirth: normalizeDateOfBirth(input.dateOfBirth),
        gender: input.gender,
        address: input.address,
        createdByUserId: actor.userId,
      });

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          patientId: patient.id,
          registrationNumber: patient.registrationNumber,
        },
        'opd_patient_registered',
      );

      return patient;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.opdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            errorCode: error.code,
          },
          'opd_patient_registration_failed',
        );
      }

      throw error;
    }
  }

  async getPatientById(patientId: string) {
    const patient = await opdRepository.findPatientById(patientId);

    if (!patient) {
      throw new AppError('Patient not found', HTTP_STATUS.notFound, ERROR_CODES.patientNotFound);
    }

    return patient;
  }

  async getDoctorPrincipalById(doctorUserId: string) {
    const user = await opdRepository.findUserById(doctorUserId);

    if (!user || !user.isActive) {
      throw new AppError('Doctor not found', HTTP_STATUS.notFound, ERROR_CODES.doctorNotFound);
    }

    if (user.role !== UserRole.DOCTOR) {
      throw new AppError(
        'Scheduling target must be an active doctor principal',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.schedulingTargetNotDoctor,
      );
    }

    return user;
  }
}

export const opdService = new OpdService();
