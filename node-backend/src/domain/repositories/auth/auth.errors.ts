import { ERROR_CODES } from '../../../shared/constants/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../shared/utils/logger.js';

export const wrapAuthStoreError = (
  action: string,
  error: unknown,
): never => {
  if (error instanceof AppError) {
    throw error;
  }

  logger.error({ action, error }, 'auth_repository_failed');
  throw new AppError(
    'Authentication temporarily unavailable',
    503,
    ERROR_CODES.authUnavailable,
  );
};
