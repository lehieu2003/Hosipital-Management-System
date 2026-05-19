import {
  BedMovementType,
  InpatientAdmissionStatus,
  type Bed,
  type BedOccupancy,
  type InpatientAdmission,
  type InpatientBedMovement,
  type Prisma,
  type User,
} from '@prisma/client';

import { db } from '../../infrastructure/database/client.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

export type CreateInpatientAdmissionRecordInput = {
  patientId: string;
  attendingDoctorUserId?: string;
  admittedByUserId: string;
  admittedAt?: Date;
  notes?: string | null;
};

export type AssignBedToAdmissionRecordInput = {
  admissionId: string;
  bedId: string;
  expectedAdmissionVersion: number;
  actorUserId: string;
  note?: string | null;
};

export type TransferAdmissionBedRecordInput = {
  admissionId: string;
  targetBedId: string;
  expectedAdmissionVersion: number;
  expectedOccupancyVersion: number;
  actorUserId: string;
  note?: string | null;
};

export type DischargeAdmissionRecordInput = {
  admissionId: string;
  expectedAdmissionVersion: number;
  expectedOccupancyVersion?: number;
  actorUserId: string;
  dischargedAt: Date;
  dischargeNotes?: string | null;
  movementNote?: string | null;
};

export type BedRecord = Pick<Bed, 'id' | 'bedNumber' | 'wardName' | 'roomNumber' | 'isActive' | 'createdAt' | 'updatedAt'>;
export type BedOperatorRecord = Pick<User, 'id' | 'username' | 'role' | 'isActive'>;

export type BedOccupancyRecord = Pick<
  BedOccupancy,
  'id' | 'admissionId' | 'bedId' | 'assignedByUserId' | 'assignedAt' | 'lastTransferredAt' | 'version' | 'createdAt' | 'updatedAt'
> & {
  bed: BedRecord;
  assignedByUser: BedOperatorRecord;
};

export type InpatientAdmissionRecord = Pick<
  InpatientAdmission,
  | 'id'
  | 'patientId'
  | 'status'
  | 'attendingDoctorUserId'
  | 'admittedByUserId'
  | 'admittedAt'
  | 'dischargeAt'
  | 'dischargeNotes'
  | 'dischargedByUserId'
  | 'notes'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
> & {
  currentBedOccupancy: BedOccupancyRecord | null;
};

export type InpatientAdmissionWithPatientRecord = InpatientAdmissionRecord & {
  patient: {
    id: string;
    registrationNumber: string;
    fullName: string;
    primaryPhone: string;
  };
};

export type InpatientBedMovementRecord = Pick<
  InpatientBedMovement,
  'id' | 'admissionId' | 'movementType' | 'fromBedId' | 'toBedId' | 'movedByUserId' | 'movedAt' | 'note' | 'createdAt'
> & {
  fromBed: BedRecord | null;
  toBed: BedRecord | null;
  movedByUser: BedOperatorRecord;
};

export type CurrentBedOccupancyRecord = BedOccupancyRecord & {
  admission: {
    id: string;
    patientId: string;
    status: InpatientAdmissionStatus;
    admittedAt: Date;
    dischargeAt: Date | null;
    version: number;
    patient: {
      id: string;
      registrationNumber: string;
      fullName: string;
      primaryPhone: string;
    };
  };
};

export type AssignBedWriteResult =
  | {
      ok: true;
      admission: InpatientAdmissionRecord;
      movement: InpatientBedMovementRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'admission_not_active'
        | 'admission_already_has_bed'
        | 'bed_not_found'
        | 'bed_inactive'
        | 'bed_occupied'
        | 'stale_admission_version';
    };

export type TransferBedWriteResult =
  | {
      ok: true;
      admission: InpatientAdmissionRecord;
      movement: InpatientBedMovementRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'admission_not_active'
        | 'admission_has_no_bed'
        | 'bed_not_found'
        | 'bed_inactive'
        | 'bed_occupied'
        | 'same_bed'
        | 'stale_admission_version'
        | 'stale_occupancy_version';
    };

export type DischargeAdmissionWriteResult =
  | {
      ok: true;
      admission: InpatientAdmissionRecord;
      movement: InpatientBedMovementRecord | null;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'admission_not_active'
        | 'stale_admission_version'
        | 'stale_occupancy_version';
    };

const wrapIpdStoreError = (
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
    'ipd_repository_failed',
  );

  throw new AppError(
    'IPD persistence is temporarily unavailable',
    503,
    ERROR_CODES.ipdUnavailable,
  );
};

const bedSelect = {
  id: true,
  bedNumber: true,
  wardName: true,
  roomNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const operatorSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
} as const;

const bedOccupancySelect = {
  id: true,
  admissionId: true,
  bedId: true,
  assignedByUserId: true,
  assignedAt: true,
  lastTransferredAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  bed: {
    select: bedSelect,
  },
  assignedByUser: {
    select: operatorSelect,
  },
} as const;

const admissionSelect = {
  id: true,
  patientId: true,
  status: true,
  attendingDoctorUserId: true,
  admittedByUserId: true,
  admittedAt: true,
  dischargeAt: true,
  dischargeNotes: true,
  dischargedByUserId: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  currentBedOccupancy: {
    select: bedOccupancySelect,
  },
} as const;

const admissionWithPatientSelect = {
  ...admissionSelect,
  patient: {
    select: {
      id: true,
      registrationNumber: true,
      fullName: true,
      primaryPhone: true,
    },
  },
} as const;

const bedMovementSelect = {
  id: true,
  admissionId: true,
  movementType: true,
  fromBedId: true,
  toBedId: true,
  movedByUserId: true,
  movedAt: true,
  note: true,
  createdAt: true,
  fromBed: {
    select: bedSelect,
  },
  toBed: {
    select: bedSelect,
  },
  movedByUser: {
    select: operatorSelect,
  },
} as const;

const currentBedOccupancySelect = {
  ...bedOccupancySelect,
  admission: {
    select: {
      id: true,
      patientId: true,
      status: true,
      admittedAt: true,
      dischargeAt: true,
      version: true,
      patient: {
        select: {
          id: true,
          registrationNumber: true,
          fullName: true,
          primaryPhone: true,
        },
      },
    },
  },
} as const;

const isUniqueConstraintError = (error: unknown): error is { code: string; meta?: { target?: string | string[] } } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'P2002';

const getUniqueConstraintTargets = (error: { meta?: { target?: string | string[] } }) => {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.map(String);
  }

  if (typeof target === 'string') {
    return [target];
  }

  return [];
};

class IpdRepository {
  async createAdmission(data: CreateInpatientAdmissionRecordInput) {
    try {
      const admission = await db.inpatientAdmission.create({
        data: {
          patientId: data.patientId,
          attendingDoctorUserId: data.attendingDoctorUserId,
          admittedByUserId: data.admittedByUserId,
          admittedAt: data.admittedAt,
          notes: data.notes,
        },
        select: admissionSelect,
      });

      return admission as InpatientAdmissionRecord;
    } catch (error) {
      return wrapIpdStoreError('create_admission', error, {
        patientId: data.patientId,
        admittedByUserId: data.admittedByUserId,
      });
    }
  }

  async findAdmissionById(admissionId: string) {
    try {
      const admission = await db.inpatientAdmission.findUnique({
        where: { id: admissionId },
        select: admissionSelect,
      });

      return admission as InpatientAdmissionRecord | null;
    } catch (error) {
      return wrapIpdStoreError('find_admission_by_id', error, {
        admissionId,
      });
    }
  }

  async findAdmissionWithPatientById(admissionId: string) {
    try {
      const admission = await db.inpatientAdmission.findUnique({
        where: { id: admissionId },
        select: admissionWithPatientSelect,
      });

      return admission as InpatientAdmissionWithPatientRecord | null;
    } catch (error) {
      return wrapIpdStoreError('find_admission_with_patient_by_id', error, {
        admissionId,
      });
    }
  }

  async findPatientById(patientId: string) {
    try {
      return await db.patient.findUnique({
        where: { id: patientId },
      });
    } catch (error) {
      return wrapIpdStoreError('find_patient_by_id', error, {
        patientId,
      });
    }
  }

  async findUserById(userId: string) {
    try {
      return await db.user.findUnique({
        where: { id: userId },
      });
    } catch (error) {
      return wrapIpdStoreError('find_user_by_id', error, {
        userId,
      });
    }
  }

  async findBedById(bedId: string) {
    try {
      const bed = await db.bed.findUnique({
        where: { id: bedId },
        select: bedSelect,
      });

      return bed as BedRecord | null;
    } catch (error) {
      return wrapIpdStoreError('find_bed_by_id', error, {
        bedId,
      });
    }
  }

  async listCurrentOccupancy() {
    try {
      const occupancy = await db.bedOccupancy.findMany({
        orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
        select: currentBedOccupancySelect,
      });

      return occupancy as CurrentBedOccupancyRecord[];
    } catch (error) {
      return wrapIpdStoreError('list_current_occupancy', error);
    }
  }

  async listMovementHistoryByAdmissionId(admissionId: string) {
    try {
      const movements = await db.inpatientBedMovement.findMany({
        where: { admissionId },
        orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
        select: bedMovementSelect,
      });

      return movements as InpatientBedMovementRecord[];
    } catch (error) {
      return wrapIpdStoreError('list_movement_history_by_admission_id', error, {
        admissionId,
      });
    }
  }

  async assignBedToAdmission({
    admissionId,
    bedId,
    expectedAdmissionVersion,
    actorUserId,
    note,
  }: AssignBedToAdmissionRecordInput): Promise<AssignBedWriteResult> {
    try {
      return await db.$transaction(async (tx) => {
        const admission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!admission) {
          return { ok: false, reason: 'admission_not_found' };
        }

        if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
          return { ok: false, reason: 'admission_not_active' };
        }

        if (admission.currentBedOccupancy) {
          return { ok: false, reason: 'admission_already_has_bed' };
        }

        const bed = await tx.bed.findUnique({
          where: { id: bedId },
          select: bedSelect,
        });

        if (!bed) {
          return { ok: false, reason: 'bed_not_found' };
        }

        if (!bed.isActive) {
          return { ok: false, reason: 'bed_inactive' };
        }

        const versionUpdate = await tx.inpatientAdmission.updateMany({
          where: {
            id: admissionId,
            status: InpatientAdmissionStatus.ADMITTED,
            version: expectedAdmissionVersion,
          },
          data: {
            version: { increment: 1 },
          },
        });

        if (versionUpdate.count === 0) {
          return { ok: false, reason: 'stale_admission_version' };
        }

        const occupancy = await tx.bedOccupancy.create({
          data: {
            admissionId,
            bedId,
            assignedByUserId: actorUserId,
          },
        });

        const movement = await tx.inpatientBedMovement.create({
          data: {
            admissionId,
            movementType: BedMovementType.ASSIGNED,
            toBedId: bedId,
            movedByUserId: actorUserId,
            note,
          },
          select: bedMovementSelect,
        });

        const updatedAdmission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!updatedAdmission) {
          throw new Error('Admission write returned no row after successful bed assignment');
        }

        if (!occupancy) {
          throw new Error('Bed assignment returned no occupancy row');
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement: movement as InpatientBedMovementRecord,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const targets = getUniqueConstraintTargets(error);
        if (targets.some((target) => target.includes('bed_id'))) {
          return { ok: false, reason: 'bed_occupied' };
        }

        if (targets.some((target) => target.includes('admission_id'))) {
          return { ok: false, reason: 'admission_already_has_bed' };
        }
      }

      return wrapIpdStoreError('assign_bed_to_admission', error, {
        admissionId,
        bedId,
        expectedAdmissionVersion,
        actorUserId,
      });
    }
  }

  async transferAdmissionBed({
    admissionId,
    targetBedId,
    expectedAdmissionVersion,
    expectedOccupancyVersion,
    actorUserId,
    note,
  }: TransferAdmissionBedRecordInput): Promise<TransferBedWriteResult> {
    try {
      return await db.$transaction(async (tx) => {
        const admission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!admission) {
          return { ok: false, reason: 'admission_not_found' };
        }

        if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
          return { ok: false, reason: 'admission_not_active' };
        }

        if (!admission.currentBedOccupancy) {
          return { ok: false, reason: 'admission_has_no_bed' };
        }

        if (admission.currentBedOccupancy.bedId === targetBedId) {
          return { ok: false, reason: 'same_bed' };
        }

        const targetBed = await tx.bed.findUnique({
          where: { id: targetBedId },
          select: bedSelect,
        });

        if (!targetBed) {
          return { ok: false, reason: 'bed_not_found' };
        }

        if (!targetBed.isActive) {
          return { ok: false, reason: 'bed_inactive' };
        }

        const admissionVersionUpdate = await tx.inpatientAdmission.updateMany({
          where: {
            id: admissionId,
            status: InpatientAdmissionStatus.ADMITTED,
            version: expectedAdmissionVersion,
          },
          data: {
            version: { increment: 1 },
          },
        });

        if (admissionVersionUpdate.count === 0) {
          return { ok: false, reason: 'stale_admission_version' };
        }

        const occupancyVersionUpdate = await tx.bedOccupancy.updateMany({
          where: {
            id: admission.currentBedOccupancy.id,
            admissionId,
            bedId: admission.currentBedOccupancy.bedId,
            version: expectedOccupancyVersion,
          },
          data: {
            bedId: targetBedId,
            assignedByUserId: actorUserId,
            lastTransferredAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (occupancyVersionUpdate.count === 0) {
          return { ok: false, reason: 'stale_occupancy_version' };
        }

        const movement = await tx.inpatientBedMovement.create({
          data: {
            admissionId,
            movementType: BedMovementType.TRANSFERRED,
            fromBedId: admission.currentBedOccupancy.bedId,
            toBedId: targetBedId,
            movedByUserId: actorUserId,
            note,
          },
          select: bedMovementSelect,
        });

        const updatedAdmission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!updatedAdmission) {
          throw new Error('Admission write returned no row after successful bed transfer');
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement: movement as InpatientBedMovementRecord,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const targets = getUniqueConstraintTargets(error);
        if (targets.some((target) => target.includes('bed_id'))) {
          return { ok: false, reason: 'bed_occupied' };
        }
      }

      return wrapIpdStoreError('transfer_admission_bed', error, {
        admissionId,
        targetBedId,
        expectedAdmissionVersion,
        expectedOccupancyVersion,
        actorUserId,
      });
    }
  }

  async dischargeAdmission({
    admissionId,
    expectedAdmissionVersion,
    expectedOccupancyVersion,
    actorUserId,
    dischargedAt,
    dischargeNotes,
    movementNote,
  }: DischargeAdmissionRecordInput): Promise<DischargeAdmissionWriteResult> {
    try {
      return await db.$transaction(async (tx) => {
        const admission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!admission) {
          return { ok: false, reason: 'admission_not_found' };
        }

        if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
          return { ok: false, reason: 'admission_not_active' };
        }

        const admissionVersionUpdate = await tx.inpatientAdmission.updateMany({
          where: {
            id: admissionId,
            status: InpatientAdmissionStatus.ADMITTED,
            version: expectedAdmissionVersion,
          },
          data: {
            status: InpatientAdmissionStatus.DISCHARGED,
            dischargeAt: dischargedAt,
            dischargeNotes,
            dischargedByUserId: actorUserId,
            version: { increment: 1 },
          },
        });

        if (admissionVersionUpdate.count === 0) {
          return { ok: false, reason: 'stale_admission_version' };
        }

        let movement: InpatientBedMovementRecord | null = null;

        if (admission.currentBedOccupancy) {
          if (expectedOccupancyVersion === undefined) {
            return { ok: false, reason: 'stale_occupancy_version' };
          }

          const deletedOccupancy = await tx.bedOccupancy.deleteMany({
            where: {
              id: admission.currentBedOccupancy.id,
              admissionId,
              bedId: admission.currentBedOccupancy.bedId,
              version: expectedOccupancyVersion,
            },
          });

          if (deletedOccupancy.count === 0) {
            return { ok: false, reason: 'stale_occupancy_version' };
          }

          movement = (await tx.inpatientBedMovement.create({
            data: {
              admissionId,
              movementType: BedMovementType.DISCHARGED,
              fromBedId: admission.currentBedOccupancy.bedId,
              movedByUserId: actorUserId,
              note: movementNote ?? dischargeNotes,
            },
            select: bedMovementSelect,
          })) as InpatientBedMovementRecord;
        }

        const updatedAdmission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!updatedAdmission) {
          throw new Error('Admission write returned no row after successful discharge');
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement,
        };
      });
    } catch (error) {
      return wrapIpdStoreError('discharge_admission', error, {
        admissionId,
        expectedAdmissionVersion,
        expectedOccupancyVersion,
        actorUserId,
      });
    }
  }
}

export const ipdRepository = new IpdRepository();
export type IpdBedRecord = BedRecord;
export type IpdBedOccupancyRecord = BedOccupancyRecord;
export type IpdCurrentBedOccupancyRecord = CurrentBedOccupancyRecord;
export type IpdAdmissionRecord = InpatientAdmissionRecord;
export type IpdAdmissionWithPatientRecord = InpatientAdmissionWithPatientRecord;
export type IpdBedMovementRecord = InpatientBedMovementRecord;
