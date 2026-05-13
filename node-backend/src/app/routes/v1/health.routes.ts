import { healthController } from '../../controllers/health.controller.js';

import { Router } from 'express';

export const healthRoutes = Router();

healthRoutes.get('/healthz', healthController);
