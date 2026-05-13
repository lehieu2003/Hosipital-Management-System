import { UserRole, type RefreshSession, type User } from '@prisma/client';

import { db } from '../../infrastructure/database/client.js';

type CreateRefreshSessionInput = {
  tokenJti: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

class AuthRepository {
  findUserByUsername(username: string) {
    return db.user.findUnique({
      where: { username },
    });
  }

  findUserById(id: string) {
    return db.user.findUnique({
      where: { id },
    });
  }

  createUser(data: {
    username: string;
    passwordHash: string;
    role: UserRole;
    isActive?: boolean;
  }) {
    return db.user.create({
      data,
    });
  }

  createRefreshSession(data: CreateRefreshSessionInput) {
    return db.refreshSession.create({
      data,
    });
  }

  findRefreshSessionByJti(tokenJti: string) {
    return db.refreshSession.findUnique({
      where: { tokenJti },
      include: { user: true },
    });
  }

  revokeRefreshSession(tokenJti: string, revokeReason: string, replacedByJti?: string) {
    return db.refreshSession.updateMany({
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
  }

  revokeAllUserSessions(userId: string, revokeReason: string) {
    return db.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason,
      },
    });
  }
}

export const authRepository = new AuthRepository();
export type AuthUserRecord = User;
export type AuthRefreshSessionRecord = RefreshSession & { user: User };
