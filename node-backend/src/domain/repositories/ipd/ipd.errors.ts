import { ERROR_CODES } from '../../../shared/constants/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../shared/utils/logger.js';

export const wrapIpdStoreError = (
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
    'ipd_repository_failed',
  );

  throw new AppError(
    'IPD persistence is temporarily unavailable',
    503,
    ERROR_CODES.ipdUnavailable,
  );
};

export const isUniqueConstraintError = (
  error: unknown,
): error is { code: string; meta?: { target?: string | string[] } } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'P2002';

export const getUniqueConstraintTargets = (error: {
  meta?: { target?: string | string[] };
}) => {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.map(String);
  }

  if (typeof target === 'string') {
    return [target];
  }

  return [];
};
