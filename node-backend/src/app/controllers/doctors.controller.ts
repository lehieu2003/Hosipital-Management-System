import type { Response } from 'express';

import { opdService } from '../../domain/services/opd.service.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

export const listSchedulableDoctorsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const doctors = await opdService.listSchedulableDoctors(principal);

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: doctors,
    });
  },
);
