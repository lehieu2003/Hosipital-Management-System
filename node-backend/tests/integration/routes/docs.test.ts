import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';

const originalNodeEnv = process.env.NODE_ENV;

describe('Swagger docs routes', () => {
  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    vi.resetModules();
  });

  it('should serve Swagger UI outside production', async () => {
    const redirectResponse = await request(createApp()).get('/api/v1/docs');
    const response = await request(createApp()).get('/api/v1/docs/');

    expect(redirectResponse.status).toBe(301);
    expect(redirectResponse.headers.location).toBe('/api/v1/docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('should serve Swagger UI static assets from the docs path', async () => {
    const response = await request(createApp()).get('/api/v1/docs/swagger-ui.css');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/css');
  });

  it('should serve the OpenAPI document outside production', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe('Hospital Management System API');
    expect(response.body.paths).toEqual(
      expect.objectContaining({
        '/healthz': expect.any(Object),
        '/auth/login': expect.any(Object),
        '/auth/refresh': expect.any(Object),
        '/auth/logout': expect.any(Object),
        '/auth/me': expect.any(Object),
      }),
    );
  });

  it('should not expose Swagger UI or OpenAPI JSON in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';

    const { createApp: createProductionApp } = await import('../../../src/app.js');
    const app = createProductionApp();

    const docsResponse = await request(app).get('/api/v1/docs');
    const specResponse = await request(app).get('/api/v1/openapi.json');

    expect(docsResponse.status).toBe(404);
    expect(specResponse.status).toBe(404);
  });
});
