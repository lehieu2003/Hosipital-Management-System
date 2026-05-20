import { db } from '../../../infrastructure/database/client.js';
import {
  admissionSelect,
  admissionWithPatientSelect,
  bedSelect,
  currentBedOccupancySelect,
  bedMovementSelect,
} from './ipd.select.js';
import { wrapIpdStoreError } from './ipd.errors.js';
import type {
  BedRecord,
  CreateInpatientAdmissionRecordInput,
  CurrentBedOccupancyRecord,
  InpatientAdmissionRecord,
  InpatientAdmissionWithPatientRecord,
  InpatientBedMovementRecord,
} from './ipd.types.js';

export class IpdQueries {
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
}
