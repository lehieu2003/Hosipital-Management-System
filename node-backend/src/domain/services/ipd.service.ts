import { InpatientAdmissionStatus, UserRole } from '@prisma/client';

import type { AuthPrincipal } from '../../app/middlewares/auth.middleware.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import {
  ipdRepository,
  type IpdAdmissionRecord,
  type IpdCurrentBedOccupancyRecord,
} from '../repositories/ipd.repository.js';

export type AdmitPatientInput = {
  patientId: string;
  attendingDoctorUserId?: string;
  admittedAt?: string;
  notes?: string | null;
};

export type AssignBedInput = {
  bedId: string;
  expectedAdmissionVersion: number;
  note?: string | null;
};

export type TransferBedInput = {
  targetBedId: string;
  expectedAdmissionVersion: number;
  expectedOccupancyVersion: number;
  note?: string | null;
};

export type DischargeAdmissionInput = {
  expectedAdmissionVersion: number;
  expectedOccupancyVersion?: number;
  dischargedAt?: string;
  dischargeNotes?: string | null;
  movementNote?: string | null;
};

const normalizeTimestamp = (value?: string) => (value ? new Date(value) : undefined);

const ensureIpdOperatorActor = (actor: AuthPrincipal) => {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.RECEPTIONIST) {
    return;
  }

  logger.warn(
    {
      actorRole: actor.role,
      actorUserId: actor.userId,
    },
    'ipd_operator_role_denied',
  );

  throw new AppError(
    'Role is not permitted for this resource',
    HTTP_STATUS.forbidden,
    ERROR_CODES.forbidden,
  );
};

class IpdService {
  async admitPatient(input: AdmitPatientInput, actor: AuthPrincipal) {
    ensureIpdOperatorActor(actor);

    await this.getPatientById(input.patientId);

    if (input.attendingDoctorUserId) {
      await this.getActiveDoctorById(input.attendingDoctorUserId, actor);
    }

    try {
      const admission = await ipdRepository.createAdmission({
        patientId: input.patientId,
        attendingDoctorUserId: input.attendingDoctorUserId,
        admittedByUserId: actor.userId,
        admittedAt: normalizeTimestamp(input.admittedAt),
        notes: input.notes,
      });

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: admission.id,
          patientId: admission.patientId,
          admissionStatus: admission.status,
          admissionVersion: admission.version,
        },
        'ipd_admission_created',
      );

      return admission;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            patientId: input.patientId,
            attendingDoctorUserId: input.attendingDoctorUserId,
            errorCode: error.code,
          },
          'ipd_admission_create_failed',
        );
      }

      throw error;
    }
  }

  async assignBed(admissionId: string, input: AssignBedInput, actor: AuthPrincipal) {
    ensureIpdOperatorActor(actor);

    const currentAdmission = await this.getAdmissionById(admissionId);

    if (currentAdmission.status !== InpatientAdmissionStatus.ADMITTED) {
      logger.warn(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: currentAdmission.id,
          patientId: currentAdmission.patientId,
          admissionStatus: currentAdmission.status,
          expectedAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: currentAdmission.version,
        },
        'ipd_bed_assignment_invalid_transition',
      );

      throw new AppError(
        'Only admitted patients can receive bed assignments',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.admissionInvalidStatusTransition,
      );
    }

    if (currentAdmission.currentBedOccupancy) {
      logger.warn(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: currentAdmission.id,
          patientId: currentAdmission.patientId,
          currentBedId: currentAdmission.currentBedOccupancy.bedId,
          expectedAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: currentAdmission.version,
        },
        'ipd_bed_assignment_duplicate_denied',
      );

      throw new AppError(
        'Admission already has an assigned bed',
        HTTP_STATUS.conflict,
        ERROR_CODES.admissionBedAssignmentConflict,
      );
    }

    try {
      const result = await ipdRepository.assignBedToAdmission({
        admissionId,
        bedId: input.bedId,
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        actorUserId: actor.userId,
        note: input.note,
      });

      if (!result.ok) {
        switch (result.reason) {
          case 'admission_not_found':
            throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
          case 'bed_not_found':
            throw new AppError('Bed not found', HTTP_STATUS.notFound, ERROR_CODES.bedNotFound);
          case 'bed_inactive':
            throw new AppError(
              'Bed is inactive and cannot receive admissions',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.bedInactive,
            );
          case 'admission_not_active':
            throw new AppError(
              'Only admitted patients can receive bed assignments',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.admissionInvalidStatusTransition,
            );
          case 'admission_already_has_bed':
            throw new AppError(
              'Admission already has an assigned bed',
              HTTP_STATUS.conflict,
              ERROR_CODES.admissionBedAssignmentConflict,
            );
          case 'bed_occupied':
            throw new AppError(
              'Target bed is already occupied',
              HTTP_STATUS.conflict,
              ERROR_CODES.bedOccupancyConflict,
            );
          case 'stale_admission_version':
            throw new AppError(
              'Admission version conflict',
              HTTP_STATUS.conflict,
              ERROR_CODES.admissionVersionConflict,
            );
        }
      }

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: result.admission.id,
          patientId: result.admission.patientId,
          bedId: input.bedId,
          movementId: result.movement.id,
          movementType: result.movement.movementType,
          previousAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: result.admission.version,
          occupancyVersion: result.admission.currentBedOccupancy?.version ?? null,
        },
        'ipd_bed_assigned',
      );

      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            admissionId,
            bedId: input.bedId,
            expectedAdmissionVersion: input.expectedAdmissionVersion,
            errorCode: error.code,
          },
          'ipd_bed_assignment_failed',
        );
      }

      throw error;
    }
  }

  async transferBed(admissionId: string, input: TransferBedInput, actor: AuthPrincipal) {
    ensureIpdOperatorActor(actor);

    const currentAdmission = await this.getAdmissionById(admissionId);

    if (currentAdmission.status !== InpatientAdmissionStatus.ADMITTED) {
      logger.warn(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: currentAdmission.id,
          patientId: currentAdmission.patientId,
          admissionStatus: currentAdmission.status,
          expectedAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: currentAdmission.version,
        },
        'ipd_bed_transfer_invalid_transition',
      );

      throw new AppError(
        'Only admitted patients can transfer beds',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.admissionInvalidStatusTransition,
      );
    }

    if (!currentAdmission.currentBedOccupancy) {
      logger.warn(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: currentAdmission.id,
          patientId: currentAdmission.patientId,
          expectedAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: currentAdmission.version,
        },
        'ipd_bed_transfer_without_assignment_denied',
      );

      throw new AppError(
        'Admission has no current bed assignment',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.admissionBedNotAssigned,
      );
    }

    try {
      const result = await ipdRepository.transferAdmissionBed({
        admissionId,
        targetBedId: input.targetBedId,
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        expectedOccupancyVersion: input.expectedOccupancyVersion,
        actorUserId: actor.userId,
        note: input.note,
      });

      if (!result.ok) {
        switch (result.reason) {
          case 'admission_not_found':
            throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
          case 'bed_not_found':
            throw new AppError('Bed not found', HTTP_STATUS.notFound, ERROR_CODES.bedNotFound);
          case 'bed_inactive':
            throw new AppError(
              'Bed is inactive and cannot receive transfers',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.bedInactive,
            );
          case 'admission_not_active':
            throw new AppError(
              'Only admitted patients can transfer beds',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.admissionInvalidStatusTransition,
            );
          case 'admission_has_no_bed':
            throw new AppError(
              'Admission has no current bed assignment',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.admissionBedNotAssigned,
            );
          case 'same_bed':
            throw new AppError(
              'Target bed must differ from the current bed',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.bedTransferSameBed,
            );
          case 'bed_occupied':
            throw new AppError(
              'Target bed is already occupied',
              HTTP_STATUS.conflict,
              ERROR_CODES.bedOccupancyConflict,
            );
          case 'stale_admission_version':
            throw new AppError(
              'Admission version conflict',
              HTTP_STATUS.conflict,
              ERROR_CODES.admissionVersionConflict,
            );
          case 'stale_occupancy_version':
            throw new AppError(
              'Bed occupancy version conflict',
              HTTP_STATUS.conflict,
              ERROR_CODES.bedOccupancyVersionConflict,
            );
        }
      }

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: result.admission.id,
          patientId: result.admission.patientId,
          fromBedId: currentAdmission.currentBedOccupancy.bedId,
          toBedId: input.targetBedId,
          movementId: result.movement.id,
          movementType: result.movement.movementType,
          previousAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: result.admission.version,
          previousOccupancyVersion: input.expectedOccupancyVersion,
          currentOccupancyVersion: result.admission.currentBedOccupancy?.version ?? null,
        },
        'ipd_bed_transferred',
      );

      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            admissionId,
            targetBedId: input.targetBedId,
            expectedAdmissionVersion: input.expectedAdmissionVersion,
            expectedOccupancyVersion: input.expectedOccupancyVersion,
            errorCode: error.code,
          },
          'ipd_bed_transfer_failed',
        );
      }

      throw error;
    }
  }

  async dischargeAdmission(admissionId: string, input: DischargeAdmissionInput, actor: AuthPrincipal) {
    ensureIpdOperatorActor(actor);

    const currentAdmission = await this.getAdmissionById(admissionId);

    if (currentAdmission.status !== InpatientAdmissionStatus.ADMITTED) {
      logger.warn(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: currentAdmission.id,
          patientId: currentAdmission.patientId,
          admissionStatus: currentAdmission.status,
          expectedAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: currentAdmission.version,
        },
        'ipd_discharge_invalid_transition',
      );

      throw new AppError(
        'Only admitted patients can be discharged',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.admissionInvalidStatusTransition,
      );
    }

    if (currentAdmission.currentBedOccupancy && input.expectedOccupancyVersion === undefined) {
      throw new AppError(
        'Discharge requires the current bed occupancy version when a bed is assigned',
        HTTP_STATUS.badRequest,
        ERROR_CODES.validationError,
      );
    }

    try {
      const result = await ipdRepository.dischargeAdmission({
        admissionId,
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        expectedOccupancyVersion: input.expectedOccupancyVersion,
        actorUserId: actor.userId,
        dischargedAt: normalizeTimestamp(input.dischargedAt) ?? new Date(),
        dischargeNotes: input.dischargeNotes,
        movementNote: input.movementNote,
      });

      if (!result.ok) {
        switch (result.reason) {
          case 'admission_not_found':
            throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
          case 'admission_not_active':
            throw new AppError(
              'Only admitted patients can be discharged',
              HTTP_STATUS.unprocessableEntity,
              ERROR_CODES.admissionInvalidStatusTransition,
            );
          case 'stale_admission_version':
            throw new AppError(
              'Admission version conflict',
              HTTP_STATUS.conflict,
              ERROR_CODES.admissionVersionConflict,
            );
          case 'stale_occupancy_version':
            throw new AppError(
              'Bed occupancy version conflict',
              HTTP_STATUS.conflict,
              ERROR_CODES.bedOccupancyVersionConflict,
            );
        }
      }

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: result.admission.id,
          patientId: result.admission.patientId,
          dischargeAt: result.admission.dischargeAt?.toISOString() ?? null,
          movementId: result.movement?.id ?? null,
          movementType: result.movement?.movementType ?? null,
          previousAdmissionVersion: input.expectedAdmissionVersion,
          currentAdmissionVersion: result.admission.version,
          previousOccupancyVersion: input.expectedOccupancyVersion ?? null,
        },
        'ipd_admission_discharged',
      );

      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            admissionId,
            expectedAdmissionVersion: input.expectedAdmissionVersion,
            expectedOccupancyVersion: input.expectedOccupancyVersion,
            errorCode: error.code,
          },
          'ipd_discharge_failed',
        );
      }

      throw error;
    }
  }

  async listCurrentOccupancy(actor: AuthPrincipal): Promise<IpdCurrentBedOccupancyRecord[]> {
    ensureIpdOperatorActor(actor);

    try {
      const occupancy = await ipdRepository.listCurrentOccupancy();

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          occupancyCount: occupancy.length,
          admissionIds: occupancy.map((entry) => entry.admission.id),
          bedIds: occupancy.map((entry) => entry.bedId),
        },
        'ipd_current_occupancy_read',
      );

      return occupancy;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            errorCode: error.code,
          },
          'ipd_current_occupancy_read_failed',
        );
      }

      throw error;
    }
  }

  async getMovementHistory(admissionId: string, actor: AuthPrincipal) {
    ensureIpdOperatorActor(actor);
    const admission = await this.getAdmissionById(admissionId);

    try {
      const movements = await ipdRepository.listMovementHistoryByAdmissionId(admissionId);

      logger.info(
        {
          actorRole: actor.role,
          actorUserId: actor.userId,
          admissionId: admission.id,
          patientId: admission.patientId,
          movementCount: movements.length,
          movementIds: movements.map((movement) => movement.id),
        },
        'ipd_movement_history_read',
      );

      return movements;
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.ipdUnavailable) {
        logger.error(
          {
            actorRole: actor.role,
            actorUserId: actor.userId,
            admissionId,
            errorCode: error.code,
          },
          'ipd_movement_history_read_failed',
        );
      }

      throw error;
    }
  }

  async getAdmissionById(admissionId: string): Promise<IpdAdmissionRecord> {
    const admission = await ipdRepository.findAdmissionById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', HTTP_STATUS.notFound, ERROR_CODES.admissionNotFound);
    }

    return admission;
  }

  async getPatientById(patientId: string) {
    const patient = await ipdRepository.findPatientById(patientId);

    if (!patient) {
      throw new AppError('Patient not found', HTTP_STATUS.notFound, ERROR_CODES.patientNotFound);
    }

    return patient;
  }

  async getActiveDoctorById(doctorUserId: string, actor?: AuthPrincipal) {
    const user = await ipdRepository.findUserById(doctorUserId);

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
        'ipd_attending_doctor_validation_denied',
      );

      throw new AppError(
        'Attending doctor must be an active doctor principal',
        HTTP_STATUS.unprocessableEntity,
        ERROR_CODES.attendingDoctorNotDoctor,
      );
    }

    return user;
  }
}

export const ipdService = new IpdService();
