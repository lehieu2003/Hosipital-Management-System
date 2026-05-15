import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authRepository } from '../../domain/repositories/auth.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { verifyAccessToken } from '../../shared/helpers/jwt.helper.js';
import { logger } from '../../shared/utils/logger.js';

export type AuthPrincipal = {
  userId: string;
  role: string;
  username: string;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthPrincipal;
};

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    logger.warn({ reason: 'missing_bearer_token', url: req.originalUrl }, 'auth_access_denied');
    return next(new AppError('Bearer token is required', 401, 'MISSING_BEARER_TOKEN'));
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    const user = await authRepository.findUserById(payload.sub);

    if (!user || !user.isActive) {
      logger.warn({ userId: payload.sub, reason: 'invalid_access_token' }, 'auth_access_denied');
      return next(new AppError('Invalid access token', 401, 'INVALID_ACCESS_TOKEN'));
    }

    if (payload.role !== user.role) {
      logger.warn(
        {
          dbRole: user.role,
          tokenRole: payload.role,
          userId: user.id,
        },
        'auth_role_claim_ignored',
      );
    }

    req.auth = {
      userId: user.id,
      role: user.role,
      username: user.username,
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn({ reason: 'expired_access_token' }, 'auth_access_denied');
      return next(new AppError('Access token expired', 401, 'EXPIRED_ACCESS_TOKEN'));
    }

    logger.warn({ reason: 'invalid_access_token' }, 'auth_access_denied');
    return next(new AppError('Invalid access token', 401, 'INVALID_ACCESS_TOKEN'));
  }
};

