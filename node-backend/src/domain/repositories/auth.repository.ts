import { UserRole, type RefreshSession, type User } from '@prisma/client';

import { db } from '../../infrastructure/database/client.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

type CreateRefreshSessionInput = {
  tokenJti: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

const wrapAuthStoreError = (action: string, error: unknown): never => {
  if (error instanceof AppError) {
    throw error;
  }

  logger.error({ action, error }, 'auth_repository_failed');
  throw new AppError('Authentication temporarily unavailable', 503, ERROR_CODES.authUnavailable);
};

class AuthRepository {
  async findUserByUsername(username: string) {
    try {
      return await db.user.findUnique({
        where: { username },
      });
    } catch (error) {
      return wrapAuthStoreError('find_user_by_username', error);
    }
  }

  async findUserById(id: string) {
    try {
      return await db.user.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapAuthStoreError('find_user_by_id', error);
    }
  }

  async createUser(data: {
    username: string;
    passwordHash: string;
    role: UserRole;
    isActive?: boolean;
  }) {
    try {
      return await db.user.create({
        data,
      });
    } catch (error) {
      return wrapAuthStoreError('create_user', error);
    }
  }

  async createRefreshSession(data: CreateRefreshSessionInput) {
    try {
      return await db.refreshSession.create({
        data,
      });
    } catch (error) {
      return wrapAuthStoreError('create_refresh_session', error);
    }
  }

  async findRefreshSessionByJti(tokenJti: string) {
    try {
      return await db.refreshSession.findUnique({
        where: { tokenJti },
        include: { user: true },
      });
    } catch (error) {
      return wrapAuthStoreError('find_refresh_session_by_jti', error);
    }
  }

  async revokeRefreshSession(tokenJti: string, revokeReason: string, replacedByJti?: string) {
    try {
      return await db.refreshSession.updateMany({
        where: {
          tokenJti,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason,
          replacedByJti,
        },
      });
    } catch (error) {
      return wrapAuthStoreError('revoke_refresh_session', error);
    }
  }

  async revokeAllUserSessions(userId: string, revokeReason: string) {
    try {
      return await db.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason,
        },
      });
    } catch (error) {
      return wrapAuthStoreError('revoke_all_user_sessions', error);
    }
  }
}

export const authRepository = new AuthRepository();
export type AuthUserRecord = User;
export type AuthRefreshSessionRecord = RefreshSession & { user: User };
