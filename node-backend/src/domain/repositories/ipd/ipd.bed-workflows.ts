import { BedMovementType, InpatientAdmissionStatus } from '@prisma/client/index';

import { db } from '../../../infrastructure/database/client.js';
import { syncBillingSettlementForDischargeTx } from '../billing.repository.js';
import { bedMovementSelect, bedSelect, admissionSelect } from './ipd.select.js';
import {
  getUniqueConstraintTargets,
  isUniqueConstraintError,
  wrapIpdStoreError,
} from './ipd.errors.js';
import type {
  AssignBedToAdmissionRecordInput,
  AssignBedWriteResult,
  DischargeAdmissionRecordInput,
  DischargeAdmissionWriteResult,
  InpatientAdmissionRecord,
  InpatientBedMovementRecord,
  TransferAdmissionBedRecordInput,
  TransferBedWriteResult,
} from './ipd.types.js';

type IpdWriteConflictReason =
  | Extract<AssignBedWriteResult, { ok: false }>['reason']
  | Extract<TransferBedWriteResult, { ok: false }>['reason']
  | Extract<DischargeAdmissionWriteResult, { ok: false }>['reason'];

class IpdWriteConflict extends Error {
  constructor(readonly reason: IpdWriteConflictReason) {
    super(reason);
  }
}

const rollback = (reason: IpdWriteConflictReason): never => {
  throw new IpdWriteConflict(reason);
};

export class IpdBedWorkflows {
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

        await tx.bedOccupancy.create({
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
          throw new Error(
            'Admission write returned no row after successful bed assignment',
          );
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement: movement as InpatientBedMovementRecord,
        };
      });
    } catch (error) {
      if (error instanceof IpdWriteConflict) {
        return { ok: false, reason: error.reason } as AssignBedWriteResult;
      }

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
          rollback('stale_admission_version');
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
          throw new Error(
            'Admission write returned no row after successful bed transfer',
          );
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement: movement as InpatientBedMovementRecord,
        };
      });
    } catch (error) {
      if (error instanceof IpdWriteConflict) {
        return { ok: false, reason: error.reason } as TransferBedWriteResult;
      }

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
          rollback('stale_admission_version');
        }

        const billingSettlement = await syncBillingSettlementForDischargeTx(tx, {
          admissionId,
          actorUserId,
          dischargedAt,
        });

        if (!billingSettlement.ok) {
          if (billingSettlement.reason === 'invalid_settlement_transition') {
            rollback('invalid_settlement_transition');
          }

          throw new Error(
            `Billing settlement sync failed after discharge update: ${billingSettlement.reason}`,
          );
        }

        const updatedAdmission = await tx.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: admissionSelect,
        });

        if (!updatedAdmission) {
          throw new Error(
            'Admission write returned no row after successful discharge',
          );
        }

        return {
          ok: true,
          admission: updatedAdmission as InpatientAdmissionRecord,
          movement,
          billingInvoice: billingSettlement.invoice,
        };
      });
    } catch (error) {
      if (error instanceof IpdWriteConflict) {
        return { ok: false, reason: error.reason } as DischargeAdmissionWriteResult;
      }

      return wrapIpdStoreError('discharge_admission', error, {
        admissionId,
        expectedAdmissionVersion,
        expectedOccupancyVersion,
        actorUserId,
      });
    }
  }
}
