import type { Response } from 'express';

import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { opdService } from '../../domain/services/opd.service.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  appointmentIdParamsSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/opd.validator.js';

const serializeAppointment = (appointment: Awaited<ReturnType<typeof opdService.createAppointment>>) => ({
  id: appointment.id,
  patientId: appointment.patientId,
  doctorUserId: appointment.doctorUserId,
  scheduledAt: appointment.scheduledAt.toISOString(),
  durationMinutes: appointment.durationMinutes,
  status: appointment.status,
  notes: appointment.notes ?? null,
  version: appointment.version,
  createdAt: appointment.createdAt.toISOString(),
  updatedAt: appointment.updatedAt.toISOString(),
});

export const createAppointmentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const payload = createAppointmentSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const appointment = await opdService.createAppointment(payload, principal);

    return res.status(HTTP_STATUS.created).json({
      success: true,
      data: serializeAppointment(appointment),
    });
  },
);

export const updateAppointmentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const params = appointmentIdParamsSchema.parse(req.params);
    const payload = updateAppointmentSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const appointment = await opdService.updateAppointment(params.appointmentId, payload, principal);

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: serializeAppointment(appointment),
    });
  },
);
