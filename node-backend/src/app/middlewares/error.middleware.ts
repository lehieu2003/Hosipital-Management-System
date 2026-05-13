import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logger.error({ error, method: req.method, url: req.originalUrl }, 'request_failed');

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof Error) {
    return res.status(HTTP_STATUS.internalServerError).json({
      success: false,
      error: {
        code: ERROR_CODES.internalError,
        message: error.message || 'An unexpected error occurred',
      },
    });
  }

  return res.status(HTTP_STATUS.internalServerError).json({
    success: false,
    error: {
      code: ERROR_CODES.internalError,
      message: 'An unexpected error occurred',
    },
  });
};
