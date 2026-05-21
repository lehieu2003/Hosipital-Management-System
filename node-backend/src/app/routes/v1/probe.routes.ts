import { UserRole } from '@prisma/client/index';
import { Router } from 'express';

import type { AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { denyByDefault, requireRoles } from '../../middlewares/rbac.middleware.js';

export const probeRoutes = Router();

const buildProbeResponse = (req: AuthenticatedRequest, route: string, requiredRoles: UserRole[]) => ({
  success: true,
  data: {
    route,
    requiredRoles,
    principal: {
      userId: req.auth?.userId,
      username: req.auth?.username,
      role: req.auth?.role,
    },
  },
});

probeRoutes.use('/probe', authMiddleware);

probeRoutes.get('/probe/admin', requireRoles(UserRole.ADMIN), (req, res) => {
  return res.status(200).json(buildProbeResponse(req, 'admin', [UserRole.ADMIN]));
});

probeRoutes.get('/probe/receptionist', requireRoles(UserRole.RECEPTIONIST), (req, res) => {
  return res.status(200).json(buildProbeResponse(req, 'receptionist', [UserRole.RECEPTIONIST]));
});

probeRoutes.get('/probe/doctor', requireRoles(UserRole.DOCTOR), (req, res) => {
  return res.status(200).json(buildProbeResponse(req, 'doctor', [UserRole.DOCTOR]));
});

probeRoutes.get('/probe/unscoped', denyByDefault(), (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      route: 'unscoped',
    },
  });
});
