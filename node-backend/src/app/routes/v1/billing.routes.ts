import { UserRole } from '@prisma/client';
import { Router } from 'express';

import {
  appendBillingChargeController,
  getBillingInvoiceController,
  recordBillingPaymentController,
} from '../../controllers/billing.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/rbac.middleware.js';

export const billingRoutes = Router();

billingRoutes.get(
  '/billing/admissions/:admissionId/invoice',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  getBillingInvoiceController,
);

billingRoutes.post(
  '/billing/admissions/:admissionId/charges',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  appendBillingChargeController,
);

billingRoutes.post(
  '/billing/admissions/:admissionId/payments',
  authMiddleware,
  requireRoles(UserRole.ADMIN, UserRole.RECEPTIONIST),
  recordBillingPaymentController,
);
