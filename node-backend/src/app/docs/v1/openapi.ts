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
    {
      name: 'Patients',
      description: 'OPD patient registration operations',
    },
    {
      name: 'Appointments',
      description: 'OPD appointment scheduling and version-guarded update operations',
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
      CreatePatientRequest: {
        type: 'object',
        required: ['fullName', 'primaryPhone'],
        properties: {
          fullName: {
            type: 'string',
            example: 'Jane Doe',
          },
          primaryPhone: {
            type: 'string',
            example: '+1555000111',
          },
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            example: 'jane@example.com',
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            nullable: true,
            example: '1990-04-12',
          },
          gender: {
            type: 'string',
            enum: ['FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED'],
            nullable: true,
          },
          address: {
            type: 'string',
            nullable: true,
            example: '123 Main Street',
          },
        },
      },
      Patient: {
        type: 'object',
        required: [
          'id',
          'registrationNumber',
          'fullName',
          'primaryPhone',
          'email',
          'dateOfBirth',
          'gender',
          'address',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: {
            type: 'string',
            example: 'patient_1',
          },
          registrationNumber: {
            type: 'string',
            example: 'REG-1',
          },
          fullName: {
            type: 'string',
            example: 'Jane Doe',
          },
          primaryPhone: {
            type: 'string',
            example: '+1555000111',
          },
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            example: 'jane@example.com',
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            nullable: true,
            example: '1990-04-12',
          },
          gender: {
            type: 'string',
            enum: ['FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED'],
            nullable: true,
          },
          address: {
            type: 'string',
            nullable: true,
            example: '123 Main Street',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      PatientEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            $ref: '#/components/schemas/Patient',
          },
        },
      },
      CreateAppointmentRequest: {
        type: 'object',
        required: ['patientId', 'doctorUserId', 'scheduledAt'],
        properties: {
          patientId: {
            type: 'string',
            example: 'patient_1',
          },
          doctorUserId: {
            type: 'string',
            example: 'user_1',
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-05-15T09:30:00.000Z',
          },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            maximum: 1440,
            default: 30,
            example: 30,
          },
          notes: {
            type: 'string',
            nullable: true,
            example: 'First consultation',
          },
        },
      },
      UpdateAppointmentRequest: {
        type: 'object',
        required: ['version'],
        properties: {
          version: {
            type: 'integer',
            minimum: 1,
            example: 1,
          },
          doctorUserId: {
            type: 'string',
            example: 'user_1',
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-05-15T10:00:00.000Z',
          },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            maximum: 1440,
            example: 45,
          },
          status: {
            type: 'string',
            enum: ['SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
          },
          notes: {
            type: 'string',
            nullable: true,
            example: 'Updated note',
          },
        },
        description: 'At least one mutable appointment field must be supplied in addition to version.',
      },
      Appointment: {
        type: 'object',
        required: [
          'id',
          'patientId',
          'doctorUserId',
          'scheduledAt',
          'durationMinutes',
          'status',
          'notes',
          'version',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: {
            type: 'string',
            example: 'appointment_1',
          },
          patientId: {
            type: 'string',
            example: 'patient_1',
          },
          doctorUserId: {
            type: 'string',
            example: 'user_1',
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-05-15T09:30:00.000Z',
          },
          durationMinutes: {
            type: 'integer',
            example: 30,
          },
          status: {
            type: 'string',
            enum: ['SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
          },
          notes: {
            type: 'string',
            nullable: true,
            example: 'First consultation',
          },
          version: {
            type: 'integer',
            example: 1,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AppointmentEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            $ref: '#/components/schemas/Appointment',
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
    '/patients': {
      post: {
        tags: ['Patients'],
        summary: 'Register a new OPD patient',
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatePatientRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Patient created successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PatientEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body validation failed.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
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
          '403': {
            description: 'Authenticated principal does not have scheduling privileges.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'OPD persistence is temporarily unavailable.',
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
    '/appointments': {
      post: {
        tags: ['Appointments'],
        summary: 'Create an appointment against an existing doctor principal',
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAppointmentRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Appointment created successfully with deterministic initial status/version.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AppointmentEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body validation failed.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
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
          '403': {
            description: 'Authenticated principal does not have scheduling privileges.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '404': {
            description: 'Referenced patient or doctor principal does not exist.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '422': {
            description: 'Referenced scheduling target exists but is not a doctor principal.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'OPD persistence is temporarily unavailable.',
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
    '/appointments/{appointmentId}': {
      patch: {
        tags: ['Appointments'],
        summary: 'Update an appointment with optimistic concurrency control',
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'appointmentId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Appointment identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateAppointmentRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Appointment updated successfully and version incremented.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AppointmentEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body validation failed.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
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
          '403': {
            description: 'Authenticated principal does not have scheduling privileges.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '404': {
            description: 'Appointment or referenced doctor principal was not found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '409': {
            description: 'Optimistic concurrency version check failed.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '422': {
            description: 'Referenced scheduling target exists but is not a doctor principal.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'OPD persistence is temporarily unavailable.',
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
