import type { Request, Response } from 'express';

import { appConfig } from '../../shared/configs/app.config.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authService } from '../../domain/services/auth.service.js';
import { loginSchema } from '../validators/auth.validator.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: appConfig.NODE_ENV === 'production',
  maxAge: appConfig.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  path: `${appConfig.API_PREFIX}/auth`,
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const session = await authService.login(payload.username, payload.password);

  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, buildRefreshCookieOptions());

  return res.status(200).json({
    success: true,
    data: {
      accessToken: session.accessToken,
      user: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      },
    },
  });
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      },
    });
  }

  const session = await authService.refresh(refreshToken);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, buildRefreshCookieOptions());

  return res.status(200).json({
    success: true,
    data: {
      accessToken: session.accessToken,
      user: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      },
    },
  });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as Request & { auth?: { userId: string } }).auth?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Bearer token is required',
      },
    });
  }

  const user = await authService.me(userId);

  return res.status(200).json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(refreshToken);
  res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());

  return res.status(200).json({
    success: true,
    data: {
      ok: true,
    },
  });
});
