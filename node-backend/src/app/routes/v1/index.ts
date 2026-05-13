import { Router } from 'express';

import { authRoutes } from './auth.routes.js';
import { healthRoutes } from './health.routes.js';

export const v1Routes = Router();

v1Routes.use(healthRoutes);
v1Routes.use(authRoutes);
