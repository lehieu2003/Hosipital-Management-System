import type { IncomingMessage, ServerResponse } from 'node:http';

import pino, { type LoggerOptions } from 'pino';

type HeaderValue = Record<string, unknown> | undefined;

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie'] as const;

export const redactHeaders = (headers: HeaderValue) => {
  if (!headers) {
    return headers;
  }

  const sanitized = { ...headers };
  for (const header of SENSITIVE_HEADERS) {
    if (header in sanitized) {
      sanitized[header] = '[redacted]';
    }
  }

  return sanitized;
};

export const serializeRequestForLogs = (req: IncomingMessage) => {
  const serialized = pino.stdSerializers.req(req);
  return serialized
    ? {
        ...serialized,
        headers: redactHeaders(serialized.headers as HeaderValue),
      }
    : serialized;
};

export const serializeResponseForLogs = (res: ServerResponse) => {
  const serialized = pino.stdSerializers.res(res);
  return serialized
    ? {
        ...serialized,
        headers: redactHeaders(serialized.headers as HeaderValue),
      }
    : serialized;
};

const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.accessToken',
      'req.body.password',
      'req.body.refreshToken',
    ],
    censor: '[redacted]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

export const logger = pino(loggerOptions);
