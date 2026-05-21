import { type RefreshSession, UserRole, type User } from '@prisma/client/index';

export type CreateUserRecordInput = {
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive?: boolean;
};

export type CreateRefreshSessionInput = {
  tokenJti: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

export type AuthUserRecord = User;
export type AuthRefreshSessionRecord = RefreshSession & { user: User };
