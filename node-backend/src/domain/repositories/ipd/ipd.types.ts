import {
  InpatientAdmissionStatus,
  type Bed,
  type BedOccupancy,
  type InpatientAdmission,
  type InpatientBedMovement,
  type User,
} from '@prisma/client/index';

import type { BillingInvoiceRecord } from '../billing/billing.types.js';

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

export type BedRecord = Pick<
  Bed,
  | 'id'
  | 'bedNumber'
  | 'wardName'
  | 'roomNumber'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
>;

export type BedOperatorRecord = Pick<
  User,
  'id' | 'username' | 'role' | 'isActive'
>;

export type BedOccupancyRecord = Pick<
  BedOccupancy,
  | 'id'
  | 'admissionId'
  | 'bedId'
  | 'assignedByUserId'
  | 'assignedAt'
  | 'lastTransferredAt'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
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
  | 'id'
  | 'admissionId'
  | 'movementType'
  | 'fromBedId'
  | 'toBedId'
  | 'movedByUserId'
  | 'movedAt'
  | 'note'
  | 'createdAt'
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
      billingInvoice: BillingInvoiceRecord;
    }
  | {
      ok: false;
      reason:
        | 'admission_not_found'
        | 'admission_not_active'
        | 'stale_admission_version'
        | 'stale_occupancy_version'
        | 'invalid_settlement_transition';
    };

export type IpdBillingInvoiceRecord = BillingInvoiceRecord;

export type IpdBedRecord = BedRecord;
export type IpdBedOccupancyRecord = BedOccupancyRecord;
export type IpdCurrentBedOccupancyRecord = CurrentBedOccupancyRecord;
export type IpdAdmissionRecord = InpatientAdmissionRecord;
export type IpdAdmissionWithPatientRecord = InpatientAdmissionWithPatientRecord;
export type IpdBedMovementRecord = InpatientBedMovementRecord;
