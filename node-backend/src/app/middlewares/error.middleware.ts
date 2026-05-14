import { ZodError } from 'zod';
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
  if (error instanceof ZodError) {
    logger.warn(
      {
        issues: error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join('.'),
        })),
        method: req.method,
        url: req.originalUrl,
      },
      'request_validation_failed',
    );

    return res.status(HTTP_STATUS.badRequest).json({
      success: false,
      error: {
        code: ERROR_CODES.validationError,
        message: 'Invalid request body',
        details: error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join('.'),
        })),
      },
    });
  }

  if (error instanceof AppError) {
    logger.warn(
      {
        code: error.code,
        statusCode: error.statusCode,
        method: req.method,
        url: req.originalUrl,
      },
      'request_rejected',
    );

    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof Error) {
    logger.error({ error, method: req.method, url: req.originalUrl }, 'request_failed');

    return res.status(HTTP_STATUS.internalServerError).json({
      success: false,
      error: {
        code: ERROR_CODES.internalError,
        message: error.message || 'An unexpected error occurred',
      },
    });
  }

  logger.error({ error, method: req.method, url: req.originalUrl }, 'request_failed');

  return res.status(HTTP_STATUS.internalServerError).json({
    success: false,
    error: {
      code: ERROR_CODES.internalError,
      message: 'An unexpected error occurred',
    },
  });
};
