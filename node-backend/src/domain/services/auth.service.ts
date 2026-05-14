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
import { logger } from '../../shared/utils/logger.js';
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

      logger.info({ username: seed.username, role: seed.role }, 'auth_seed_user_created');
    }
  }

  async login(username: string, password: string) {
    await this.ensureSeedUsers();

    const user = await authRepository.findUserByUsername(username);
    if (!user || !user.isActive) {
      logger.warn({ username, reason: 'invalid_credentials' }, 'auth_login_denied');
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      logger.warn({ username, reason: 'invalid_credentials' }, 'auth_login_denied');
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

    logger.info({ userId: user.id, username: user.username, role: user.role }, 'auth_login_succeeded');

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
      logger.warn({ userId, reason: 'invalid_access_token' }, 'auth_me_denied');
      throw new AppError('Invalid access token', 401, 'INVALID_ACCESS_TOKEN');
    }

    return user;
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn({ reason: 'expired_refresh_token' }, 'auth_refresh_denied');
        throw new AppError('Refresh token expired', 401, 'EXPIRED_REFRESH_TOKEN');
      }

      logger.warn({ reason: 'invalid_refresh_token' }, 'auth_refresh_denied');
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const session = await authRepository.findRefreshSessionByJti(payload.jti);
    if (!session) {
      logger.warn({ userId: payload.sub, reason: 'refresh_session_missing' }, 'auth_refresh_denied');
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    if (session.revokedAt) {
      logger.warn({ userId: session.user.id, reason: 'refresh_session_revoked' }, 'auth_refresh_denied');
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    if (session.tokenHash !== hashToken(refreshToken)) {
      logger.warn({ userId: session.user.id, reason: 'refresh_hash_mismatch' }, 'auth_refresh_denied');
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      logger.warn({ userId: session.user.id, reason: 'refresh_session_expired' }, 'auth_refresh_denied');
      throw new AppError('Refresh token expired', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    if (!session.user.isActive) {
      logger.warn({ userId: session.user.id, reason: 'user_inactive' }, 'auth_refresh_denied');
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
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
      logger.warn({ userId: session.user.id, reason: 'refresh_replay_or_race' }, 'auth_refresh_denied');
      throw new AppError('Refresh token revoked', 401, 'REVOKED_REFRESH_TOKEN');
    }

    await authRepository.createRefreshSession({
      tokenJti: nextRefresh.jti,
      tokenHash: hashToken(nextRefresh.token),
      userId: session.user.id,
      expiresAt: refreshExpiresAt,
    });

    logger.info({ userId: session.user.id, role: session.user.role }, 'auth_refresh_rotated');

    return {
      accessToken,
      refreshToken: nextRefresh.token,
      user: session.user,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      logger.info({ reason: 'missing_refresh_cookie' }, 'auth_logout_skipped');
      return;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      await authRepository.revokeRefreshSession(payload.jti, 'logout');
      logger.info({ userId: payload.sub }, 'auth_logout_completed');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.warn({ reason: 'invalid_refresh_token' }, 'auth_logout_skipped');
    }
  }
}

export const authService = new AuthService();
