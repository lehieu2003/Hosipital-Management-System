import { db } from '../../../infrastructure/database/client.js';
import { wrapAuthStoreError } from './auth.errors.js';
import type { CreateRefreshSessionInput } from './auth.types.js';

export class AuthRefreshSessionQueries {
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

  async revokeRefreshSession(
    tokenJti: string,
    revokeReason: string,
    replacedByJti?: string,
  ) {
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
