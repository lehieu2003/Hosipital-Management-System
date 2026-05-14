import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pinoHttpModule from 'pino-http';

import { errorMiddleware } from './app/middlewares/error.middleware.js';
import { v1Routes } from './app/routes/v1/index.js';
import { appConfig } from './shared/configs/app.config.js';
import {
  logger,
  serializeRequestForLogs,
  serializeResponseForLogs,
} from './shared/utils/logger.js';

const pinoHttp = pinoHttpModule.default ?? pinoHttpModule;

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
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: serializeRequestForLogs,
        res: serializeResponseForLogs,
      },
      wrapSerializers: false,
    }),
  );
  app.use(appConfig.API_PREFIX, v1Routes);
  app.use(errorMiddleware);

  return app;
};
