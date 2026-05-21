import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;
import { Router } from 'express';

import {
  getDoctorQueueController,
  updateDoctorQueueAppointmentController,
} from '../../controllers/doctor-queue.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const doctorQueueRoutes = Router();

doctorQueueRoutes.get(
  '/doctor/queue',
  authMiddleware,
  requireRoles(UserRole.DOCTOR),
  getDoctorQueueController,
);

doctorQueueRoutes.patch(
  '/doctor/queue/:appointmentId',
  authMiddleware,
  requireRoles(UserRole.DOCTOR),
  updateDoctorQueueAppointmentController,
);
