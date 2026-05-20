import { ERROR_CODES } from '../../../shared/constants/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../shared/utils/logger.js';

export const wrapOpdStoreError = (
  action: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): never => {
  if (error instanceof AppError) {
    throw error;
  }

  logger.error(
    {
      action,
      ...(metadata ?? {}),
      error,
    },
    'opd_repository_failed',
  );

  throw new AppError(
    'OPD persistence is temporarily unavailable',
    503,
    ERROR_CODES.opdUnavailable,
  );
};
