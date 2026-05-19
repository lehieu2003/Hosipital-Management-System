import { UserRole } from '@prisma/client';
import { Router } from 'express';

import {
  assignBedController,
  createAdmissionController,
  dischargeAdmissionController,
  getAdmissionMovementsController,
  getCurrentOccupancyController,
  transferBedController,
} from '../../controllers/ipd.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const ipdRoutes = Router();

ipdRoutes.post(
  '/ipd/admissions',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  createAdmissionController,
);

ipdRoutes.post(
  '/ipd/admissions/:admissionId/bed-assignment',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  assignBedController,
);

ipdRoutes.post(
  '/ipd/admissions/:admissionId/bed-transfer',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  transferBedController,
);

ipdRoutes.post(
  '/ipd/admissions/:admissionId/discharge',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  dischargeAdmissionController,
);

ipdRoutes.get(
  '/ipd/occupancy',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  getCurrentOccupancyController,
);

ipdRoutes.get(
  '/ipd/admissions/:admissionId/movements',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  getAdmissionMovementsController,
);
