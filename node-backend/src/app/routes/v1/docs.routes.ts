import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { openApiV1Document } from '../../docs/v1/openapi.js';

export const docsRoutes = Router();

docsRoutes.get('/openapi.json', (_req, res) => {
  return res.status(200).json(openApiV1Document);
});

docsRoutes.use('/docs', (req, res, next) => {
  if (req.originalUrl.endsWith('/docs')) {
    return res.redirect(301, `${req.originalUrl}/`);
  }

  return next();
});

docsRoutes.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiV1Document, {
    customSiteTitle: 'Hospital Management System API Docs',
  }),
);
