import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app.js';

describe('GET /api/v1/healthz', () => {
  it('should return health payload', async () => {
    const response = await request(createApp()).get('/api/v1/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        ready: true,
      },
    });
  });
});
