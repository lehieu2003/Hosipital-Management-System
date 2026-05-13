import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { appConfig } from '../configs/app.config.js';

export type AccessTokenPayload = {
  sub: string;
  role: string;
  username: string;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  type: 'refresh';
};

const minutesToSeconds = (minutes: number) => minutes * 60;
const daysToSeconds = (days: number) => days * 24 * 60 * 60;

export const buildAccessToken = (payload: Omit<AccessTokenPayload, 'type'>) => {
  const { sub, ...claims } = payload;

  return jwt.sign(
    {
      ...claims,
      type: 'access',
    },
    appConfig.JWT_ACCESS_SECRET,
    {
      expiresIn: minutesToSeconds(appConfig.JWT_ACCESS_TTL_MINUTES),
      subject: sub,
    },
  );
};

export const buildRefreshToken = (payload: Omit<RefreshTokenPayload, 'type' | 'jti'>) => {
  const jti = crypto.randomUUID();
  const { sub, ...claims } = payload;
  const token = jwt.sign(
    {
      ...claims,
      jti,
      type: 'refresh',
    },
    appConfig.JWT_REFRESH_SECRET,
    {
      expiresIn: daysToSeconds(appConfig.JWT_REFRESH_TTL_DAYS),
      subject: sub,
    },
  );

  return {
    token,
    jti,
  };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, appConfig.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, appConfig.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
