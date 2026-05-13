import { Router } from 'express';

import { healthController } from '@/app/controllers/health.controller';

export const healthRoutes = Router();

healthRoutes.get('/healthz', healthController);
