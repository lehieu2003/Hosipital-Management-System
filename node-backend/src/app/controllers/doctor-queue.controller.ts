import type { Response } from 'express';

import { opdService } from '../../domain/services/opd.service.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  appointmentIdParamsSchema,
  updateDoctorQueueAppointmentSchema,
} from '../validators/opd.validator.js';

type DoctorQueueAppointment = Awaited<ReturnType<typeof opdService.getDoctorQueue>>[number];

const serializeDoctorQueueItem = (appointment: DoctorQueueAppointment) => ({
  id: appointment.id,
  patientId: appointment.patientId,
  doctorUserId: appointment.doctorUserId,
  scheduledAt: appointment.scheduledAt.toISOString(),
  durationMinutes: appointment.durationMinutes,
  status: appointment.status,
  version: appointment.version,
  createdAt: appointment.createdAt.toISOString(),
  updatedAt: appointment.updatedAt.toISOString(),
  patient: {
    id: appointment.patient.id,
    registrationNumber: appointment.patient.registrationNumber,
    fullName: appointment.patient.fullName,
    primaryPhone: appointment.patient.primaryPhone,
    dateOfBirth: appointment.patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: appointment.patient.gender ?? null,
  },
});

export const getDoctorQueueController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const queue = await opdService.getDoctorQueue(principal);

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: queue.map(serializeDoctorQueueItem),
    });
  },
);

export const updateDoctorQueueAppointmentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const params = appointmentIdParamsSchema.parse(req.params);
    const payload = updateDoctorQueueAppointmentSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const appointment = await opdService.updateDoctorQueueAppointment(
      params.appointmentId,
      payload,
      principal,
    );

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: serializeDoctorQueueItem(appointment),
    });
  },
);
