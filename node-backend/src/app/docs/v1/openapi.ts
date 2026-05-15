export const openApiV1Document = {
  openapi: '3.0.3',
  info: {
    title: 'Hospital Management System API',
    version: '1.0.0',
    description: 'Current implemented v1 API surface for the Hospital Management System backend.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Version 1 API',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Service health checks',
    },
    {
      name: 'Auth',
      description: 'Authentication and session management',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refresh_token',
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            enum: [false],
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid request body',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            example: 'doctor',
          },
          password: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            format: 'password',
            example: 'secret123',
          },
        },
      },
      AuthUser: {
        type: 'object',
        required: ['id', 'username', 'role'],
        properties: {
          id: {
            type: 'string',
            example: 'clx_user_id',
          },
          username: {
            type: 'string',
            example: 'doctor',
          },
          role: {
            type: 'string',
            example: 'DOCTOR',
          },
        },
      },
      AuthSessionEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            required: ['accessToken', 'user'],
            properties: {
              accessToken: {
                type: 'string',
                description: 'JWT access token for bearer-authenticated requests.',
              },
              user: {
                $ref: '#/components/schemas/AuthUser',
              },
            },
          },
        },
      },
      CurrentUserEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            $ref: '#/components/schemas/AuthUser',
          },
        },
      },
      LogoutEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            required: ['ok'],
            properties: {
              ok: {
                type: 'boolean',
                enum: [true],
              },
            },
          },
        },
      },
      HealthEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            required: ['status', 'ready'],
            properties: {
              status: {
                type: 'string',
                enum: ['ok'],
              },
              ready: {
                type: 'boolean',
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/healthz': {
      get: {
        tags: ['Health'],
        summary: 'Check service health',
        responses: {
          '200': {
            description: 'Service is healthy and ready.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthEnvelope',
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with username and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login succeeded. Also sets an HTTP-only refresh_token cookie.',
            headers: {
              'Set-Cookie': {
                schema: {
                  type: 'string',
                  example: 'refresh_token=<jwt>; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthSessionEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request body.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'Authentication storage is temporarily unavailable.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue a new access token',
        security: [
          {
            refreshCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Refresh succeeded. Also rotates the HTTP-only refresh_token cookie.',
            headers: {
              'Set-Cookie': {
                schema: {
                  type: 'string',
                  example: 'refresh_token=<jwt>; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthSessionEnvelope',
                },
              },
            },
          },
          '401': {
            description: 'Refresh token is missing, invalid, expired, or revoked.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the refresh token when present and clear the refresh cookie',
        security: [
          {
            refreshCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Logout completed. Missing or invalid refresh cookies are treated as already logged out.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LogoutEnvelope',
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current bearer-authenticated user',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Current user resolved from the access token.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CurrentUserEnvelope',
                },
              },
            },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
