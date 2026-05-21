import { UserRole } from '@prisma/client/index';
import { Router } from 'express';

import {
  assignDepartmentDoctorController,
  createDepartmentController,
  listDepartmentsController,
} from '../../controllers/admin-config.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const adminConfigRoutes = Router();

adminConfigRoutes.post(
  '/admin/config/departments',
  authMiddleware,
  requireRoles(UserRole.ADMIN),
  createDepartmentController,
);

adminConfigRoutes.get(
  '/admin/config/departments',
  authMiddleware,
  requireRoles(UserRole.ADMIN),
  listDepartmentsController,
);

adminConfigRoutes.put(
  '/admin/config/departments/:departmentId/doctor-assignment',
  authMiddleware,
  requireRoles(UserRole.ADMIN),
  assignDepartmentDoctorController,
);
