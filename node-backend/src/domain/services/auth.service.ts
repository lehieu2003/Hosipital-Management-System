import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { appConfig } from '../../shared/configs/app.config.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../shared/helpers/hash.helper.js';
import {
  buildAccessToken,
  buildRefreshToken,
  hashToken,
  verifyRefreshToken,
} from '../../shared/helpers/jwt.helper.js';
import { authRepository } from '../repositories/auth.repository.js';

const DEFAULT_SEED_USERS = [
  { username: 'admin', password: 'secret123', role: UserRole.ADMIN },
  { username: 'reception', password: 'secret123', role: UserRole.RECEPTIONIST },
  { username: 'doctor', password: 'secret123', role: UserRole.DOCTOR },
] as const;

class AuthService {
  async ensureSeedUsers() {
    for (const seed of DEFAULT_SEED_USERS) {
      const existing = await authRepository.findUserByUsername(seed.username);
      if (existing) {
        continue;
      }

      const passwordHash = await hashPassword(seed.password);
      await authRepository.createUser({
        username: seed.username,
        passwordHash,
        role: seed.role,
      });
    }
  }

  async login(username: string, password: string) {
    await this.ensureSeedUsers();

    const user = await authRepository.findUserByUsername(username);
    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = buildAccessToken({
      sub: user.id,
      role: user.role,
      username: user.username,
    });
    const refresh = buildRefreshToken({ sub: user.id });
    const refreshExpiresAt = new Date(
      Date.now() + appConfig.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await authRepository.createRefreshSession({
      tokenJti: refresh.jti,
      tokenHash: hashToken(refresh.token),
      userId: user.id,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      user,
    };
  }

  async me(userId: string) {
    await this.ensureSeedUsers();
    const user = await authRepository.findUserById(userId);

    if (!user || !user.isActive) {
      throw new AppError('Unauthorized', 401, 'INVALID_ACCESS_TOKEN');
    }

    return user;
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401, 'EXPIRED_REFRESH_TOKEN');
      }

      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const session = await authRepository.findRefreshSessionByJti(payload.jti);
    if (!session) {
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    if (session.revokedAt) {
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    if (session.tokenHash !== hashToken(refreshToken)) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Refresh token expired', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    if (!session.user.isActive) {
      throw new AppError('Unauthorized', 401, 'INVALID_REFRESH_TOKEN');
    }

    const accessToken = buildAccessToken({
      sub: session.user.id,
      role: session.user.role,
      username: session.user.username,
    });
    const nextRefresh = buildRefreshToken({ sub: session.user.id });
    const refreshExpiresAt = new Date(
      Date.now() + appConfig.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const revokeResult = await authRepository.revokeRefreshSession(
      payload.jti,
      'rotated',
      nextRefresh.jti,
    );
    if (revokeResult.count === 0) {
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    await authRepository.createRefreshSession({
      tokenJti: nextRefresh.jti,
      tokenHash: hashToken(nextRefresh.token),
      userId: session.user.id,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken,
      refreshToken: nextRefresh.token,
      user: session.user,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      await authRepository.revokeRefreshSession(payload.jti, 'logout');
    } catch {
      return;
    }
  }
}

export const authService = new AuthService();
