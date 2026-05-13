import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-1234'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-1234'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/hms'),
});

function parseCorsOrigins(rawOrigins: string) {
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const parsedEnv = envSchema.parse(process.env);

export const appConfig = {
  ...parsedEnv,
  CORS_ORIGIN: parseCorsOrigins(parsedEnv.CORS_ORIGIN),
};
