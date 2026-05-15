import { AppointmentStatus, UserRole, type PatientGender } from '@prisma/client';

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

export type CreateAppointmentInput = {
  patientId: string;
  doctorUserId: string;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string | null;
};

export type UpdateAppointmentInput = {
  version: number;
  doctorUserId?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  notes?: string | null;
};

const normalizeDateOfBirth = (dateOfBirth?: string) => {
  if (!dateOfBirth) {
    return undefined;
  }

  return new Date(`${dateOfBirth}T00:00:00.000Z`);
};

const normalizeScheduledAt = (scheduledAt: string) => new Date(scheduledAt);

const ensureDoctorActor = (actor: AuthPrincipal) => {
  if (actor.role === UserRole.DOCTOR) {
    return;
  }

  logger.warn(
    {
      actorRole: actor.role,
      actorUserId: actor.userId,
    },
    'opd_doctor_queue_role_denied',
  );

  throw new AppError(
    'Role is not permitted for this resource',
    HTTP_STATUS.forbidden,
    ERROR_CODES.forbidden,
  );
};

class OpdService {
  async getDoctorQueue(actor: AuthPrincipal) {
    ensureDoctorActor(actor);

    try {
      const queue = await opdRepository.findActiveQueueByDoctorUserId(actor.userId);

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          appointmentIds: queue.map((appointment) => appointment.id),
          patientIds: queue.map((appointment) => appointment.patientId),
          queueCount: queue.length,
        },
        'opd_doctor_queue_read',
      );

      return queue;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.opdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            errorCode: error.code,
          },
          'opd_doctor_queue_read_failed',
        );
      }

      throw error;
    }
  }

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

  async createAppointment(input: CreateAppointmentInput, actor: AuthPrincipal) {
    await this.getPatientById(input.patientId);
    await this.getDoctorPrincipalById(input.doctorUserId, actor);

    try {
      const appointment = await opdRepository.createAppointment({
        patientId: input.patientId,
        doctorUserId: input.doctorUserId,
        scheduledAt: normalizeScheduledAt(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        notes: input.notes,
      });

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorUserId: appointment.doctorUserId,
          scheduledAt: appointment.scheduledAt.toISOString(),
          version: appointment.version,
        },
        'opd_appointment_scheduled',
      );

      return appointment;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.opdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            patientId: input.patientId,
            doctorUserId: input.doctorUserId,
            errorCode: error.code,
          },
          'opd_appointment_schedule_failed',
        );
      }

      throw error;
    }
  }

  async updateAppointment(
    appointmentId: string,
    input: UpdateAppointmentInput,
    actor: AuthPrincipal,
  ) {
    const currentAppointment = await this.getAppointmentById(appointmentId);

    if (input.doctorUserId) {
      await this.getDoctorPrincipalById(input.doctorUserId, actor);
    }

    try {
      const appointment = await opdRepository.updateAppointmentWithVersion({
        appointmentId,
        expectedVersion: input.version,
        doctorUserId: input.doctorUserId,
        scheduledAt: input.scheduledAt ? normalizeScheduledAt(input.scheduledAt) : undefined,
        durationMinutes: input.durationMinutes,
        status: input.status,
        notes: input.notes,
      });

      if (!appointment) {
        logger.warn(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            appointmentId,
            expectedVersion: input.version,
            currentVersion: currentAppointment.version,
          },
          'opd_appointment_update_conflict',
        );

        throw new AppError(
          'Appointment version conflict',
          HTTP_STATUS.conflict,
          ERROR_CODES.appointmentVersionConflict,
        );
      }

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorUserId: appointment.doctorUserId,
          scheduledAt: appointment.scheduledAt.toISOString(),
          version: appointment.version,
          previousVersion: input.version,
        },
        'opd_appointment_updated',
      );

      return appointment;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.opdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            appointmentId,
            expectedVersion: input.version,
            errorCode: error.code,
          },
          'opd_appointment_update_failed',
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

  async getAppointmentById(appointmentId: string) {
    const appointment = await opdRepository.findAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(
        'Appointment not found',
        HTTP_STATUS.notFound,
        ERROR_CODES.appointmentNotFound,
      );
    }

    return appointment;
  }

  async getDoctorPrincipalById(doctorUserId: string, actor?: AuthPrincipal) {
    const user = await opdRepository.findUserById(doctorUserId);

    if (!user || !user.isActive) {
      throw new AppError('Doctor not found', HTTP_STATUS.notFound, ERROR_CODES.doctorNotFound);
    }

    if (user.role !== UserRole.DOCTOR) {
      logger.warn(
        {
          actorRole: actor?.role,
          actorUserId: actor?.userId,
          doctorUserId,
          resolvedRole: user.role,
        },
        'opd_doctor_role_validation_denied',
      );

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
