import type { Response } from 'express';

import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { opdService } from '../../domain/services/opd.service.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { createPatientSchema } from '../validators/opd.validator.js';

const serializePatient = (patient: Awaited<ReturnType<typeof opdService.createPatient>>) => ({
  id: patient.id,
  registrationNumber: patient.registrationNumber,
  fullName: patient.fullName,
  primaryPhone: patient.primaryPhone,
  email: patient.email ?? null,
  dateOfBirth: patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
  gender: patient.gender ?? null,
  address: patient.address ?? null,
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
});

export const createPatientController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const payload = createPatientSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const patient = await opdService.createPatient(payload, principal);

    return res.status(HTTP_STATUS.created).json({
      success: true,
      data: serializePatient(patient),
    });
  },
);
