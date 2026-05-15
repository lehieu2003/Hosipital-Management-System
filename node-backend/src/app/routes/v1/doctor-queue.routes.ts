import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { getDoctorQueueController } from '../../controllers/doctor-queue.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const doctorQueueRoutes = Router();

doctorQueueRoutes.get(
  '/doctor/queue',
  authMiddleware,
  requireRoles(UserRole.DOCTOR),
  getDoctorQueueController,
);
