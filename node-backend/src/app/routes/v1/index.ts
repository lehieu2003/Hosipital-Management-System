import { Router } from 'express';

import { healthRoutes } from '@/app/routes/v1/health.routes';

export const v1Routes = Router();

v1Routes.use(healthRoutes);
