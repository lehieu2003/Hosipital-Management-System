import prismaClientPkg, { type RefreshSession, type User, type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;

export type CreateUserRecordInput = {
  username: string;
  passwordHash: string;
  role: UserRoleType;
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
