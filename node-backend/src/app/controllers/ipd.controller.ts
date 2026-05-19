import type { Response } from 'express';

import { ipdService } from '../../domain/services/ipd.service.js';
import type {
  IpdAdmissionRecord,
  IpdBedMovementRecord,
  IpdCurrentBedOccupancyRecord,
} from '../../domain/repositories/ipd.repository.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  admissionIdParamsSchema,
  assignBedSchema,
  createAdmissionSchema,
  dischargeAdmissionSchema,
  transferBedSchema,
} from '../validators/ipd.validator.js';

const serializeBed = (bed: NonNullable<IpdAdmissionRecord['currentBedOccupancy']>['bed']) => ({
  id: bed.id,
  bedNumber: bed.bedNumber,
  wardName: bed.wardName,
  roomNumber: bed.roomNumber,
  isActive: bed.isActive,
  createdAt: bed.createdAt.toISOString(),
  updatedAt: bed.updatedAt.toISOString(),
});

const serializeOperator = (user: NonNullable<IpdAdmissionRecord['currentBedOccupancy']>['assignedByUser']) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  isActive: user.isActive,
});

const serializeCurrentBedOccupancy = (occupancy: NonNullable<IpdAdmissionRecord['currentBedOccupancy']>) => ({
  id: occupancy.id,
  admissionId: occupancy.admissionId,
  bedId: occupancy.bedId,
  assignedByUserId: occupancy.assignedByUserId,
  assignedAt: occupancy.assignedAt.toISOString(),
  lastTransferredAt: occupancy.lastTransferredAt?.toISOString() ?? null,
  version: occupancy.version,
  createdAt: occupancy.createdAt.toISOString(),
  updatedAt: occupancy.updatedAt.toISOString(),
  bed: serializeBed(occupancy.bed),
  assignedByUser: serializeOperator(occupancy.assignedByUser),
});

const serializeAdmission = (admission: IpdAdmissionRecord) => ({
  id: admission.id,
  patientId: admission.patientId,
  status: admission.status,
  attendingDoctorUserId: admission.attendingDoctorUserId ?? null,
  admittedByUserId: admission.admittedByUserId,
  admittedAt: admission.admittedAt.toISOString(),
  dischargeAt: admission.dischargeAt?.toISOString() ?? null,
  dischargeNotes: admission.dischargeNotes ?? null,
  dischargedByUserId: admission.dischargedByUserId ?? null,
  notes: admission.notes ?? null,
  version: admission.version,
  createdAt: admission.createdAt.toISOString(),
  updatedAt: admission.updatedAt.toISOString(),
  currentBedOccupancy: admission.currentBedOccupancy ? serializeCurrentBedOccupancy(admission.currentBedOccupancy) : null,
});

const serializeMovement = (movement: IpdBedMovementRecord) => ({
  id: movement.id,
  admissionId: movement.admissionId,
  movementType: movement.movementType,
  fromBedId: movement.fromBedId ?? null,
  toBedId: movement.toBedId ?? null,
  movedByUserId: movement.movedByUserId,
  movedAt: movement.movedAt.toISOString(),
  note: movement.note ?? null,
  createdAt: movement.createdAt.toISOString(),
  fromBed: movement.fromBed ? serializeBed(movement.fromBed) : null,
  toBed: movement.toBed ? serializeBed(movement.toBed) : null,
  movedByUser: serializeOperator(movement.movedByUser),
});

const serializeOccupancyEntry = (entry: IpdCurrentBedOccupancyRecord) => ({
  id: entry.id,
  admissionId: entry.admissionId,
  bedId: entry.bedId,
  assignedByUserId: entry.assignedByUserId,
  assignedAt: entry.assignedAt.toISOString(),
  lastTransferredAt: entry.lastTransferredAt?.toISOString() ?? null,
  version: entry.version,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
  bed: serializeBed(entry.bed),
  assignedByUser: serializeOperator(entry.assignedByUser),
  admission: {
    id: entry.admission.id,
    patientId: entry.admission.patientId,
    status: entry.admission.status,
    admittedAt: entry.admission.admittedAt.toISOString(),
    dischargeAt: entry.admission.dischargeAt?.toISOString() ?? null,
    version: entry.admission.version,
    patient: {
      id: entry.admission.patient.id,
      registrationNumber: entry.admission.patient.registrationNumber,
      fullName: entry.admission.patient.fullName,
      primaryPhone: entry.admission.patient.primaryPhone,
    },
  },
});

const requirePrincipal = (req: AuthenticatedRequest) => {
  if (!req.auth) {
    throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
  }

  return req.auth;
};

export const createAdmissionController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const payload = createAdmissionSchema.parse(req.body);
  const admission = await ipdService.admitPatient(payload, principal);

  return res.status(HTTP_STATUS.created).json({
    success: true,
    data: serializeAdmission(admission),
  });
});

export const assignBedController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = admissionIdParamsSchema.parse(req.params);
  const payload = assignBedSchema.parse(req.body);
  const result = await ipdService.assignBed(params.admissionId, payload, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: {
      admission: serializeAdmission(result.admission),
      movement: serializeMovement(result.movement),
    },
  });
});

export const transferBedController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = admissionIdParamsSchema.parse(req.params);
  const payload = transferBedSchema.parse(req.body);
  const result = await ipdService.transferBed(params.admissionId, payload, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: {
      admission: serializeAdmission(result.admission),
      movement: serializeMovement(result.movement),
    },
  });
});

export const dischargeAdmissionController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = admissionIdParamsSchema.parse(req.params);
  const payload = dischargeAdmissionSchema.parse(req.body);
  const result = await ipdService.dischargeAdmission(params.admissionId, payload, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: {
      admission: serializeAdmission(result.admission),
      movement: result.movement ? serializeMovement(result.movement) : null,
    },
  });
});

export const getCurrentOccupancyController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const occupancy = await ipdService.listCurrentOccupancy(principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: occupancy.map(serializeOccupancyEntry),
  });
});

export const getAdmissionMovementsController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const principal = requirePrincipal(req);
  const params = admissionIdParamsSchema.parse(req.params);
  const movements = await ipdService.getMovementHistory(params.admissionId, principal);

  return res.status(HTTP_STATUS.ok).json({
    success: true,
    data: movements.map(serializeMovement),
  });
});
