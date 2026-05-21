import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;
import type { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from './auth.middleware.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

const forbiddenError = (message = 'Role is not permitted for this resource') =>
  new AppError(message, HTTP_STATUS.forbidden, ERROR_CODES.forbidden);

export const requireRoles = (...allowedRoles: UserRoleType[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const principal = req.auth;

    if (!principal) {
      logger.warn({ reason: 'missing_principal', endpoint: req.originalUrl }, 'rbac_access_denied');
      return next(new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN'));
    }

    if (allowedRoles.length === 0) {
      logger.warn(
        {
          endpoint: req.originalUrl,
          reason: 'policy_missing',
          role: principal.role,
          userId: principal.userId,
        },
        'rbac_access_denied',
      );
      return next(forbiddenError('Access policy not configured'));
    }

    if (!KNOWN_ROLES.has(principal.role)) {
      logger.warn(
        {
          endpoint: req.originalUrl,
          reason: 'unknown_role',
          role: principal.role,
          requiredRoles: allowedRoles,
          userId: principal.userId,
        },
        'rbac_access_denied',
      );
      return next(forbiddenError());
    }

    const principalRole = principal.role as UserRoleType;

    if (!allowedRoles.includes(principalRole)) {
      logger.warn(
        {
          endpoint: req.originalUrl,
          reason: 'role_forbidden',
          role: principalRole,
          requiredRoles: allowedRoles,
          userId: principal.userId,
        },
        'rbac_access_denied',
      );
      return next(forbiddenError());
    }

    logger.info(
      {
        endpoint: req.originalUrl,
        requiredRoles: allowedRoles,
        role: principalRole,
        userId: principal.userId,
      },
      'rbac_access_allowed',
    );

    return next();
  };
};

export const denyByDefault = () => requireRoles();
