import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;
import { Router } from 'express';

import { listSchedulableDoctorsController } from '../../controllers/doctors.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const doctorsRoutes = Router();

doctorsRoutes.get(
  '/doctors',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  listSchedulableDoctorsController,
);
