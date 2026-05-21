import { UserRole } from '@prisma/client/index';
import { Router } from 'express';

import {
  createAppointmentController,
  updateAppointmentController,
} from '../../controllers/appointments.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const appointmentsRoutes = Router();

appointmentsRoutes.post(
  '/appointments',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  createAppointmentController,
);

appointmentsRoutes.patch(
  '/appointments/:appointmentId',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  updateAppointmentController,
);
