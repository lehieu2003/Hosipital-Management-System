import { Router } from 'express';

import { authRoutes } from './auth.routes.js';
import { docsRoutes } from './docs.routes.js';
import { healthRoutes } from './health.routes.js';
import { probeRoutes } from './probe.routes.js';
import { appConfig } from '../../../shared/configs/app.config.js';

export const v1Routes = Router();

v1Routes.use(healthRoutes);
v1Routes.use(authRoutes);
v1Routes.use(probeRoutes);

if (appConfig.NODE_ENV !== 'production') {
  v1Routes.use(docsRoutes);
}
