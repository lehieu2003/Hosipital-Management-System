import { IpdBedWorkflows } from './ipd/ipd.bed-workflows.js';
import { IpdQueries } from './ipd/ipd.queries.js';

class IpdRepository {
  private readonly queries = new IpdQueries();
  private readonly bedWorkflows = new IpdBedWorkflows();

  createAdmission = this.queries.createAdmission.bind(this.queries);
  findAdmissionById = this.queries.findAdmissionById.bind(this.queries);
  findAdmissionWithPatientById =
    this.queries.findAdmissionWithPatientById.bind(this.queries);
  findPatientById = this.queries.findPatientById.bind(this.queries);
  findUserById = this.queries.findUserById.bind(this.queries);
  findBedById = this.queries.findBedById.bind(this.queries);
  listCurrentOccupancy = this.queries.listCurrentOccupancy.bind(this.queries);
  listMovementHistoryByAdmissionId =
    this.queries.listMovementHistoryByAdmissionId.bind(this.queries);

  assignBedToAdmission =
    this.bedWorkflows.assignBedToAdmission.bind(this.bedWorkflows);
  transferAdmissionBed =
    this.bedWorkflows.transferAdmissionBed.bind(this.bedWorkflows);
  dischargeAdmission =
    this.bedWorkflows.dischargeAdmission.bind(this.bedWorkflows);
}

export const ipdRepository = new IpdRepository();

export type {
  AssignBedToAdmissionRecordInput,
  AssignBedWriteResult,
  BedOccupancyRecord,
  BedOperatorRecord,
  BedRecord,
  CreateInpatientAdmissionRecordInput,
  CurrentBedOccupancyRecord,
  DischargeAdmissionRecordInput,
  DischargeAdmissionWriteResult,
  InpatientAdmissionRecord,
  InpatientAdmissionWithPatientRecord,
  InpatientBedMovementRecord,
  IpdAdmissionRecord,
  IpdAdmissionWithPatientRecord,
  IpdBedMovementRecord,
  IpdBedOccupancyRecord,
  IpdBedRecord,
  IpdBillingInvoiceRecord,
  IpdCurrentBedOccupancyRecord,
  TransferAdmissionBedRecordInput,
  TransferBedWriteResult,
} from './ipd/ipd.types.js';
