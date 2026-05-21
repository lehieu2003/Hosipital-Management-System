import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;
import { Router } from 'express';

import { createPatientController } from '../../controllers/patients.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const patientsRoutes = Router();

patientsRoutes.post(
  '/patients',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  createPatientController,
);
