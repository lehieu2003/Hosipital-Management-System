import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';

import { errorMiddleware } from '@/app/middlewares/error.middleware';
import { v1Routes } from '@/app/routes/v1';
import { appConfig } from '@/shared/configs/app.config';
import { logger } from '@/shared/utils/logger';

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      credentials: true,
      origin: appConfig.CORS_ORIGIN,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(appConfig.API_PREFIX, v1Routes);
  app.use(errorMiddleware);

  return app;
};
