import { Router } from 'express';

import { appConfig } from '../../../shared/configs/app.config.js';
import { adminConfigRoutes } from './admin-config.routes.js';
import { appointmentsRoutes } from './appointments.routes.js';
import { authRoutes } from './auth.routes.js';
import { docsRoutes } from './docs.routes.js';
import { doctorQueueRoutes } from './doctor-queue.routes.js';
import { doctorsRoutes } from './doctors.routes.js';
import { healthRoutes } from './health.routes.js';
import { patientsRoutes } from './patients.routes.js';
import { probeRoutes } from './probe.routes.js';

export const v1Routes = Router();

v1Routes.use(healthRoutes);
v1Routes.use(authRoutes);
v1Routes.use(probeRoutes);
v1Routes.use(adminConfigRoutes);
v1Routes.use(patientsRoutes);
v1Routes.use(doctorsRoutes);
v1Routes.use(appointmentsRoutes);
v1Routes.use(doctorQueueRoutes);

if (appConfig.NODE_ENV !== 'production') {
  v1Routes.use(docsRoutes);
}
