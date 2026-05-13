import { Router } from 'express';

import {
  loginController,
  logoutController,
  meController,
  refreshController,
} from '../../controllers/auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/login', loginController);
authRoutes.post('/auth/refresh', refreshController);
authRoutes.post('/auth/logout', logoutController);
authRoutes.get('/auth/me', authMiddleware, meController);
