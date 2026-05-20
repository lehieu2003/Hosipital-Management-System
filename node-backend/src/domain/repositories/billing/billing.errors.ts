import { ERROR_CODES } from '../../../shared/constants/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../shared/utils/logger.js';

export const wrapBillingStoreError = (
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
    'billing_repository_failed',
  );

  throw new AppError(
    'Billing persistence is temporarily unavailable',
    503,
    ERROR_CODES.billingUnavailable,
  );
};
