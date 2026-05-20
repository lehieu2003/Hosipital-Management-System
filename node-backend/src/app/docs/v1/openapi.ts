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
      name: 'Admin Configuration',
      description: 'Admin-only live department and doctor-assignment configuration',
    },
    {
      name: 'Patients',
      description: 'OPD patient registration operations',
    },
    {
      name: 'Doctors',
      description: 'Reception-facing doctor discovery derived from live admin assignments',
    },
    {
      name: 'Appointments',
      description: 'OPD appointment scheduling and version-guarded update operations',
    },
    {
      name: 'Billing',
      description: 'Admission-backed invoice lifecycle reads, idempotent charge appends, and payment settlement updates',
    },
    {
      name: 'Doctor Queue',
      description: 'Doctor-owned queue reads and lifecycle updates',
    },
    {
      name: 'IPD',
      description: 'Inpatient admission, occupancy, transfer, discharge, and movement-history operations',
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
      CreateDepartmentRequest: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
            example: 'Cardiology',
          },
        },
      },
      DepartmentAssignedDoctor: {
        type: 'object',
        required: ['id', 'username'],
        properties: {
          id: {
            type: 'string',
            example: 'user_doctor_1',
          },
          username: {
            type: 'string',
            example: 'doctor',
          },
        },
      },
      Department: {
        type: 'object',
        required: ['id', 'name', 'assignmentCount', 'assignedDoctor', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            example: 'department_1',
          },
          name: {
            type: 'string',
            example: 'Cardiology',
          },
          assignmentCount: {
            type: 'integer',
            minimum: 0,
            maximum: 1,
            example: 1,
          },
          assignedDoctor: {
            allOf: [{ $ref: '#/components/schemas/DepartmentAssignedDoctor' }],
            nullable: true,
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
        description:
          'Live admin configuration department with at most one current assigned doctor principal. The backend stays authoritative for assignment state.',
      },
      DepartmentEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            $ref: '#/components/schemas/Department',
          },
        },
      },
      DepartmentsEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Department',
            },
          },
        },
      },
      AssignDepartmentDoctorRequest: {
        type: 'object',
        required: ['doctorUserId'],
        additionalProperties: false,
        properties: {
          doctorUserId: {
            type: 'string',
            example: 'user_doctor_1',
          },
        },
      },
      DoctorDirectoryEntry: {
        type: 'object',
        required: ['id', 'username', 'departmentId', 'departmentName'],
        properties: {
          id: {
            type: 'string',
            example: 'user_1',
          },
          username: {
            type: 'string',
            example: 'doctor',
          },
          departmentId: {
            type: 'string',
            example: 'department_1',
          },
          departmentName: {
            type: 'string',
            example: 'Cardiology',
          },
        },
        description:
          'Read-only active doctor assignment for scheduling discovery. The backend emits only currently assigned doctors and includes department metadata so clients can prove live configuration without inferring it locally.',
      },
      DoctorDirectoryEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DoctorDirectoryEntry',
            },
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
      DoctorQueuePatient: {
        type: 'object',
        required: ['id', 'registrationNumber', 'fullName', 'primaryPhone', 'dateOfBirth', 'gender'],
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
        },
      },
      DoctorQueueAppointment: {
        type: 'object',
        required: [
          'id',
          'patientId',
          'doctorUserId',
          'scheduledAt',
          'durationMinutes',
          'status',
          'version',
          'createdAt',
          'updatedAt',
          'patient',
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
          version: {
            type: 'integer',
            example: 2,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          patient: {
            $ref: '#/components/schemas/DoctorQueuePatient',
          },
        },
      },
      DoctorQueueEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DoctorQueueAppointment',
            },
          },
        },
      },
      UpdateDoctorQueueAppointmentRequest: {
        type: 'object',
        required: ['version', 'status'],
        additionalProperties: false,
        properties: {
          version: {
            type: 'integer',
            minimum: 1,
            example: 1,
          },
          status: {
            type: 'string',
            enum: ['CHECKED_IN', 'COMPLETED'],
            example: 'CHECKED_IN',
          },
        },
        description:
          'Doctor-owned lifecycle update. Allowed transitions are SCHEDULED -> CHECKED_IN and CHECKED_IN -> COMPLETED.',
      },
      DoctorQueueAppointmentEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            $ref: '#/components/schemas/DoctorQueueAppointment',
          },
        },
      },
      IpdBed: {
        type: 'object',
        required: ['id', 'bedNumber', 'wardName', 'roomNumber', 'isActive', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', example: 'bed_1' },
          bedNumber: { type: 'string', example: 'A-101' },
          wardName: { type: 'string', example: 'Ward A' },
          roomNumber: { type: 'string', example: '101' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      IpdOperator: {
        type: 'object',
        required: ['id', 'username', 'role', 'isActive'],
        properties: {
          id: { type: 'string', example: 'user_reception_1' },
          username: { type: 'string', example: 'reception' },
          role: { type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
          isActive: { type: 'boolean', example: true },
        },
      },
      IpdCurrentBedOccupancy: {
        type: 'object',
        required: [
          'id',
          'admissionId',
          'bedId',
          'assignedByUserId',
          'assignedAt',
          'lastTransferredAt',
          'version',
          'createdAt',
          'updatedAt',
          'bed',
          'assignedByUser',
        ],
        properties: {
          id: { type: 'string', example: 'occupancy_1' },
          admissionId: { type: 'string', example: 'admission_1' },
          bedId: { type: 'string', example: 'bed_1' },
          assignedByUserId: { type: 'string', example: 'user_reception_1' },
          assignedAt: { type: 'string', format: 'date-time' },
          lastTransferredAt: { type: 'string', format: 'date-time', nullable: true },
          version: { type: 'integer', minimum: 1, example: 2 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          bed: { $ref: '#/components/schemas/IpdBed' },
          assignedByUser: { $ref: '#/components/schemas/IpdOperator' },
        },
      },
      IpdAdmission: {
        type: 'object',
        required: [
          'id',
          'patientId',
          'status',
          'attendingDoctorUserId',
          'admittedByUserId',
          'admittedAt',
          'dischargeAt',
          'dischargeNotes',
          'dischargedByUserId',
          'notes',
          'version',
          'createdAt',
          'updatedAt',
          'currentBedOccupancy',
        ],
        properties: {
          id: { type: 'string', example: 'admission_1' },
          patientId: { type: 'string', example: 'patient_1' },
          status: { type: 'string', enum: ['ADMITTED', 'DISCHARGED'] },
          attendingDoctorUserId: { type: 'string', nullable: true, example: 'user_doctor_1' },
          admittedByUserId: { type: 'string', example: 'user_reception_1' },
          admittedAt: { type: 'string', format: 'date-time' },
          dischargeAt: { type: 'string', format: 'date-time', nullable: true },
          dischargeNotes: { type: 'string', nullable: true, example: 'Recovered and sent home' },
          dischargedByUserId: { type: 'string', nullable: true, example: 'user_reception_1' },
          notes: { type: 'string', nullable: true, example: 'Observation required' },
          version: { type: 'integer', minimum: 1, example: 3 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          currentBedOccupancy: {
            allOf: [{ $ref: '#/components/schemas/IpdCurrentBedOccupancy' }],
            nullable: true,
          },
        },
      },
      CreateIpdAdmissionRequest: {
        type: 'object',
        required: ['patientId'],
        additionalProperties: false,
        properties: {
          patientId: { type: 'string', example: 'patient_1' },
          attendingDoctorUserId: { type: 'string', example: 'user_doctor_1' },
          admittedAt: { type: 'string', format: 'date-time', example: '2026-05-15T09:00:00.000Z' },
          notes: { type: 'string', nullable: true, example: 'Observation required' },
        },
      },
      AssignIpdBedRequest: {
        type: 'object',
        required: ['bedId', 'expectedAdmissionVersion'],
        additionalProperties: false,
        properties: {
          bedId: { type: 'string', example: 'bed_1' },
          expectedAdmissionVersion: { type: 'integer', minimum: 1, example: 1 },
          note: { type: 'string', nullable: true, example: 'Initial assignment' },
        },
      },
      TransferIpdBedRequest: {
        type: 'object',
        required: ['targetBedId', 'expectedAdmissionVersion', 'expectedOccupancyVersion'],
        additionalProperties: false,
        properties: {
          targetBedId: { type: 'string', example: 'bed_2' },
          expectedAdmissionVersion: { type: 'integer', minimum: 1, example: 2 },
          expectedOccupancyVersion: { type: 'integer', minimum: 1, example: 1 },
          note: { type: 'string', nullable: true, example: 'Escalated to monitored room' },
        },
      },
      DischargeIpdAdmissionRequest: {
        type: 'object',
        required: ['expectedAdmissionVersion'],
        additionalProperties: false,
        properties: {
          expectedAdmissionVersion: { type: 'integer', minimum: 1, example: 3 },
          expectedOccupancyVersion: { type: 'integer', minimum: 1, example: 2 },
          dischargedAt: { type: 'string', format: 'date-time', example: '2026-05-16T11:15:00.000Z' },
          dischargeNotes: { type: 'string', nullable: true, example: 'Recovered and sent home' },
          movementNote: { type: 'string', nullable: true, example: 'Bed released after discharge' },
        },
        description:
          'When the admission currently has a bed assignment, expectedOccupancyVersion is required so discharge fails closed on stale occupancy state.',
      },
      IpdBedMovement: {
        type: 'object',
        required: [
          'id',
          'admissionId',
          'movementType',
          'fromBedId',
          'toBedId',
          'movedByUserId',
          'movedAt',
          'note',
          'createdAt',
          'fromBed',
          'toBed',
          'movedByUser',
        ],
        properties: {
          id: { type: 'string', example: 'movement_1' },
          admissionId: { type: 'string', example: 'admission_1' },
          movementType: { type: 'string', enum: ['ASSIGNED', 'TRANSFERRED', 'DISCHARGED'] },
          fromBedId: { type: 'string', nullable: true, example: 'bed_1' },
          toBedId: { type: 'string', nullable: true, example: 'bed_2' },
          movedByUserId: { type: 'string', example: 'user_reception_1' },
          movedAt: { type: 'string', format: 'date-time' },
          note: { type: 'string', nullable: true, example: 'Escalated to monitored room' },
          createdAt: { type: 'string', format: 'date-time' },
          fromBed: { allOf: [{ $ref: '#/components/schemas/IpdBed' }], nullable: true },
          toBed: { allOf: [{ $ref: '#/components/schemas/IpdBed' }], nullable: true },
          movedByUser: { $ref: '#/components/schemas/IpdOperator' },
        },
      },
      IpdAdmissionEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { $ref: '#/components/schemas/IpdAdmission' },
        },
      },
      IpdAdmissionMutationResult: {
        type: 'object',
        required: ['admission', 'movement'],
        properties: {
          admission: { $ref: '#/components/schemas/IpdAdmission' },
          movement: { allOf: [{ $ref: '#/components/schemas/IpdBedMovement' }], nullable: true },
        },
      },
      IpdAdmissionMutationEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { $ref: '#/components/schemas/IpdAdmissionMutationResult' },
        },
      },
      IpdMovementHistoryEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/IpdBedMovement' },
          },
        },
      },
      IpdOccupancyEntry: {
        type: 'object',
        required: [
          'id',
          'admissionId',
          'bedId',
          'assignedByUserId',
          'assignedAt',
          'lastTransferredAt',
          'version',
          'createdAt',
          'updatedAt',
          'bed',
          'assignedByUser',
          'admission',
        ],
        properties: {
          id: { type: 'string', example: 'occupancy_1' },
          admissionId: { type: 'string', example: 'admission_1' },
          bedId: { type: 'string', example: 'bed_1' },
          assignedByUserId: { type: 'string', example: 'user_reception_1' },
          assignedAt: { type: 'string', format: 'date-time' },
          lastTransferredAt: { type: 'string', format: 'date-time', nullable: true },
          version: { type: 'integer', minimum: 1, example: 2 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          bed: { $ref: '#/components/schemas/IpdBed' },
          assignedByUser: { $ref: '#/components/schemas/IpdOperator' },
          admission: {
            type: 'object',
            required: ['id', 'patientId', 'status', 'admittedAt', 'dischargeAt', 'version', 'patient'],
            properties: {
              id: { type: 'string', example: 'admission_1' },
              patientId: { type: 'string', example: 'patient_1' },
              status: { type: 'string', enum: ['ADMITTED', 'DISCHARGED'] },
              admittedAt: { type: 'string', format: 'date-time' },
              dischargeAt: { type: 'string', format: 'date-time', nullable: true },
              version: { type: 'integer', minimum: 1, example: 3 },
              patient: {
                type: 'object',
                required: ['id', 'registrationNumber', 'fullName', 'primaryPhone'],
                properties: {
                  id: { type: 'string', example: 'patient_1' },
                  registrationNumber: { type: 'string', example: 'REG-1' },
                  fullName: { type: 'string', example: 'Jane Doe' },
                  primaryPhone: { type: 'string', example: '+1555000111' },
                },
              },
            },
          },
        },
      },
      IpdOccupancyEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/IpdOccupancyEntry' },
          },
        },
      },
      BillingActor: {
        type: 'object',
        required: ['id', 'username', 'role', 'isActive'],
        properties: {
          id: { type: 'string', example: 'user_reception_1' },
          username: { type: 'string', example: 'reception' },
          role: { type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
          isActive: { type: 'boolean', example: true },
        },
      },
      BillingPatient: {
        type: 'object',
        required: ['id', 'registrationNumber', 'fullName', 'primaryPhone'],
        properties: {
          id: { type: 'string', example: 'patient_1' },
          registrationNumber: { type: 'string', example: 'REG-1' },
          fullName: { type: 'string', example: 'Jane Doe' },
          primaryPhone: { type: 'string', example: '+1555000111' },
        },
      },
      BillingInvoiceLine: {
        type: 'object',
        required: [
          'id',
          'invoiceId',
          'lineType',
          'chargeCode',
          'description',
          'quantity',
          'unitAmountMinor',
          'lineAmountMinor',
          'metadata',
          'createdByUserId',
          'createdAt',
          'createdByUser',
        ],
        properties: {
          id: { type: 'string', example: 'bill_line_1' },
          invoiceId: { type: 'string', example: 'bill_invoice_1' },
          lineType: { type: 'string', enum: ['CHARGE'] },
          chargeCode: { type: 'string', nullable: true, example: 'ROOM_DAILY' },
          description: { type: 'string', example: 'Daily room charge' },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          unitAmountMinor: { type: 'integer', minimum: 1, example: 2500 },
          lineAmountMinor: { type: 'integer', example: 5000 },
          metadata: {
            oneOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }],
          },
          createdByUserId: { type: 'string', nullable: true, example: 'user_reception_1' },
          createdAt: { type: 'string', format: 'date-time' },
          createdByUser: {
            allOf: [{ $ref: '#/components/schemas/BillingActor' }],
            nullable: true,
          },
        },
      },
      BillingPayment: {
        type: 'object',
        required: [
          'id',
          'invoiceId',
          'amountMinor',
          'paymentMethod',
          'paymentReference',
          'note',
          'recordedByUserId',
          'receivedAt',
          'createdAt',
          'recordedByUser',
        ],
        properties: {
          id: { type: 'string', example: 'bill_payment_1' },
          invoiceId: { type: 'string', example: 'bill_invoice_1' },
          amountMinor: { type: 'integer', minimum: 1, example: 3000 },
          paymentMethod: { type: 'string', example: 'cash' },
          paymentReference: { type: 'string', nullable: true, example: 'REC-1001' },
          note: { type: 'string', nullable: true, example: 'Front desk partial payment' },
          recordedByUserId: { type: 'string', nullable: true, example: 'user_reception_1' },
          receivedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          recordedByUser: {
            allOf: [{ $ref: '#/components/schemas/BillingActor' }],
            nullable: true,
          },
        },
      },
      BillingTransition: {
        type: 'object',
        required: [
          'id',
          'invoiceId',
          'transitionType',
          'fromPaymentStatus',
          'toPaymentStatus',
          'fromSettlementStatus',
          'toSettlementStatus',
          'balanceMinor',
          'context',
          'actorUserId',
          'createdAt',
          'actorUser',
        ],
        properties: {
          id: { type: 'string', example: 'bill_transition_1' },
          invoiceId: { type: 'string', example: 'bill_invoice_1' },
          transitionType: {
            type: 'string',
            enum: [
              'INVOICE_OPENED',
              'CHARGE_APPENDED',
              'PAYMENT_RECORDED',
              'DISCHARGE_SYNC',
              'SETTLEMENT_COMPLETED',
            ],
          },
          fromPaymentStatus: {
            type: 'string',
            nullable: true,
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID_IN_FULL'],
          },
          toPaymentStatus: {
            type: 'string',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID_IN_FULL'],
          },
          fromSettlementStatus: {
            type: 'string',
            nullable: true,
            enum: ['OPEN', 'PENDING_SETTLEMENT', 'SETTLED'],
          },
          toSettlementStatus: {
            type: 'string',
            enum: ['OPEN', 'PENDING_SETTLEMENT', 'SETTLED'],
          },
          balanceMinor: { type: 'integer', example: 2000 },
          context: {
            oneOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }],
          },
          actorUserId: { type: 'string', nullable: true, example: 'user_reception_1' },
          createdAt: { type: 'string', format: 'date-time' },
          actorUser: {
            allOf: [{ $ref: '#/components/schemas/BillingActor' }],
            nullable: true,
          },
        },
      },
      BillingInvoice: {
        type: 'object',
        required: [
          'id',
          'admissionId',
          'patientId',
          'paymentStatus',
          'settlementStatus',
          'currency',
          'totalChargesMinor',
          'totalPaymentsMinor',
          'balanceMinor',
          'dischargedAt',
          'settledAt',
          'version',
          'createdByUserId',
          'createdAt',
          'updatedAt',
          'patient',
          'createdByUser',
          'lines',
          'payments',
          'transitions',
        ],
        properties: {
          id: { type: 'string', example: 'bill_invoice_1' },
          admissionId: { type: 'string', example: 'admission_1' },
          patientId: { type: 'string', example: 'patient_1' },
          paymentStatus: {
            type: 'string',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID_IN_FULL'],
          },
          settlementStatus: {
            type: 'string',
            enum: ['OPEN', 'PENDING_SETTLEMENT', 'SETTLED'],
          },
          currency: { type: 'string', example: 'USD' },
          totalChargesMinor: { type: 'integer', minimum: 0, example: 5000 },
          totalPaymentsMinor: { type: 'integer', minimum: 0, example: 3000 },
          balanceMinor: { type: 'integer', example: 2000 },
          dischargedAt: { type: 'string', format: 'date-time', nullable: true },
          settledAt: { type: 'string', format: 'date-time', nullable: true },
          version: { type: 'integer', minimum: 1, example: 4 },
          createdByUserId: { type: 'string', nullable: true, example: 'user_reception_1' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          patient: { $ref: '#/components/schemas/BillingPatient' },
          createdByUser: {
            allOf: [{ $ref: '#/components/schemas/BillingActor' }],
            nullable: true,
          },
          lines: {
            type: 'array',
            items: { $ref: '#/components/schemas/BillingInvoiceLine' },
          },
          payments: {
            type: 'array',
            items: { $ref: '#/components/schemas/BillingPayment' },
          },
          transitions: {
            type: 'array',
            items: { $ref: '#/components/schemas/BillingTransition' },
          },
        },
      },
      BillingInvoiceEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { $ref: '#/components/schemas/BillingInvoice' },
        },
      },
      AppendBillingChargeRequest: {
        type: 'object',
        required: ['description', 'quantity', 'unitAmountMinor', 'idempotencyKey'],
        additionalProperties: false,
        properties: {
          chargeCode: { type: 'string', nullable: true, example: 'ROOM_DAILY' },
          description: { type: 'string', example: 'Daily room charge' },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          unitAmountMinor: { type: 'integer', minimum: 1, example: 2500 },
          idempotencyKey: { type: 'string', example: 'charge-room-2026-05-15' },
          metadata: {
            oneOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }],
          },
          expectedInvoiceVersion: { type: 'integer', minimum: 1, example: 1 },
        },
      },
      AppendBillingChargeResult: {
        type: 'object',
        required: ['invoice', 'line', 'transition'],
        properties: {
          invoice: { $ref: '#/components/schemas/BillingInvoice' },
          line: { $ref: '#/components/schemas/BillingInvoiceLine' },
          transition: { $ref: '#/components/schemas/BillingTransition' },
        },
      },
      AppendBillingChargeEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { $ref: '#/components/schemas/AppendBillingChargeResult' },
        },
      },
      RecordBillingPaymentRequest: {
        type: 'object',
        required: ['amountMinor', 'paymentMethod'],
        additionalProperties: false,
        properties: {
          amountMinor: { type: 'integer', minimum: 1, example: 3000 },
          paymentMethod: { type: 'string', example: 'cash' },
          paymentReference: { type: 'string', nullable: true, example: 'REC-1001' },
          note: { type: 'string', nullable: true, example: 'Front desk partial payment' },
          receivedAt: { type: 'string', format: 'date-time', example: '2026-05-16T10:00:00.000Z' },
          expectedInvoiceVersion: { type: 'integer', minimum: 1, example: 2 },
        },
      },
      RecordBillingPaymentResult: {
        type: 'object',
        required: ['invoice', 'payment', 'transition'],
        properties: {
          invoice: { $ref: '#/components/schemas/BillingInvoice' },
          payment: { $ref: '#/components/schemas/BillingPayment' },
          transition: { $ref: '#/components/schemas/BillingTransition' },
        },
      },
      RecordBillingPaymentEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { $ref: '#/components/schemas/RecordBillingPaymentResult' },
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
    '/admin/config/departments': {
      get: {
        tags: ['Admin Configuration'],
        summary: 'List live departments and current doctor-assignment state',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Departments ordered by name then id with current assignment state.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DepartmentsEnvelope',
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
            description: 'Authenticated principal is not permitted to manage admin configuration.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'Department configuration storage is temporarily unavailable.',
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
      post: {
        tags: ['Admin Configuration'],
        summary: 'Create a live department for doctor assignment',
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
                $ref: '#/components/schemas/CreateDepartmentRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Department created successfully with no current doctor assignment.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DepartmentEnvelope',
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
            description: 'Authenticated principal is not permitted to manage admin configuration.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '409': {
            description: 'Department name already exists.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'Department configuration storage is temporarily unavailable.',
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
    '/admin/config/departments/{departmentId}/doctor-assignment': {
      put: {
        tags: ['Admin Configuration'],
        summary: 'Assign an active doctor principal to one live department',
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'departmentId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Department identifier to receive the current doctor assignment.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AssignDepartmentDoctorRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Department assignment updated successfully. Any prior assignment for the doctor is replaced atomically.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DepartmentEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
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
            description: 'Authenticated principal is not permitted to manage admin configuration.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '404': {
            description: 'Department or doctor principal was not found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '422': {
            description: 'Referenced assignment target exists but is not an active doctor principal.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '503': {
            description: 'Department configuration storage is temporarily unavailable.',
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
    '/doctors': {
      get: {
        tags: ['Doctors'],
        summary: 'List schedulable doctors derived from live admin assignments',
        description:
          'Read-only active doctor directory for scheduling discovery. Access is limited to admin and receptionist principals, and lookup failures fail closed as OPD_UNAVAILABLE with no fallback to all active doctor users.',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description:
              'Deterministically ordered active doctor assignments only, sorted by department name then department id.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DoctorDirectoryEnvelope',
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
            description:
              'Doctor directory lookup is temporarily unavailable or returned malformed assignment data; no partial doctor list is exposed.',
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
    '/doctor/queue': {
      get: {
        tags: ['Doctor Queue'],
        summary: 'Get the authenticated doctor active queue',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description:
              'Active queue for the authenticated doctor only, ordered by scheduledAt, createdAt, then id.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DoctorQueueEnvelope',
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
            description: 'Authenticated principal is not permitted to access doctor queue resources.',
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
    '/doctor/queue/{appointmentId}': {
      patch: {
        tags: ['Doctor Queue'],
        summary: 'Advance the authenticated doctor queue lifecycle with optimistic concurrency',
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
            description: 'Appointment identifier owned by the authenticated doctor.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateDoctorQueueAppointmentRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Doctor queue lifecycle update succeeded and version incremented.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DoctorQueueAppointmentEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
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
            description: 'Authenticated doctor does not own the appointment or is otherwise forbidden.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorEnvelope',
                },
              },
            },
          },
          '404': {
            description: 'Appointment was not found.',
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
            description: 'Requested lifecycle transition is not allowed for the appointment state.',
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
    '/billing/admissions/{admissionId}/invoice': {
      get: {
        tags: ['Billing'],
        summary: 'Read or lazily open the single admission-backed invoice',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        responses: {
          '200': {
            description: 'Invoice read succeeded. If missing, the backend opens exactly one invoice for the admission before returning it.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BillingInvoiceEnvelope' },
              },
            },
          },
          '400': {
            description: 'Path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate billing routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'Billing persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/billing/admissions/{admissionId}/charges': {
      post: {
        tags: ['Billing'],
        summary: 'Append an idempotent charge line to the admission invoice',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AppendBillingChargeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Charge append succeeded and returns the updated invoice, new line, and append-only transition record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AppendBillingChargeEnvelope' },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate billing routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '409': {
            description: 'Invoice version guard failed, duplicate charge replay was denied, or the invoice settlement state rejects further mutations.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'Billing persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/billing/admissions/{admissionId}/payments': {
      post: {
        tags: ['Billing'],
        summary: 'Record a partial or final payment against the admission invoice',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RecordBillingPaymentRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment record succeeded and returns the updated invoice, new payment, and append-only transition record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecordBillingPaymentEnvelope' },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate billing routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '409': {
            description: 'Invoice version guard failed or the invoice settlement state rejects the payment mutation.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'Billing persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/ipd/admissions': {
      post: {
        tags: ['IPD'],
        summary: 'Admit a patient into the inpatient lifecycle',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateIpdAdmissionRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Admission created successfully with an admitted status and no current bed assignment.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/IpdAdmissionEnvelope',
                },
              },
            },
          },
          '400': {
            description: 'Request body validation failed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
          '404': {
            description: 'Referenced patient or attending doctor principal was not found.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
          '422': {
            description: 'Referenced attending doctor exists but is not an active doctor principal.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
        },
      },
    },
    '/ipd/admissions/{admissionId}/bed-assignment': {
      post: {
        tags: ['IPD'],
        summary: 'Assign a current bed to an admitted inpatient',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssignIpdBedRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bed assignment succeeded and returns the updated admission plus append-only movement record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IpdAdmissionMutationEnvelope' },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission or bed was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '409': {
            description: 'Admission version check failed or the target bed is already occupied.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '422': {
            description: 'The admission is not in a state that can receive a bed or the target bed is inactive.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/ipd/admissions/{admissionId}/bed-transfer': {
      post: {
        tags: ['IPD'],
        summary: 'Transfer an admitted inpatient between beds with optimistic concurrency guards',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransferIpdBedRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer succeeded and returns the updated admission plus transfer movement record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IpdAdmissionMutationEnvelope' },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission or target bed was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '409': {
            description: 'Admission or occupancy version check failed, or the target bed is already occupied.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '422': {
            description: 'The admission cannot transfer, has no current bed, targets the same bed, or the target bed is inactive.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/ipd/admissions/{admissionId}/discharge': {
      post: {
        tags: ['IPD'],
        summary: 'Discharge an admitted inpatient and release the current bed when present',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DischargeIpdAdmissionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Discharge succeeded and returns the updated admission plus discharge movement when a bed was released.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IpdAdmissionMutationEnvelope' },
              },
            },
          },
          '400': {
            description: 'Request body or path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '409': {
            description: 'Admission or occupancy version check failed during discharge.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '422': {
            description: 'The admission is not in a dischargeable state.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/ipd/occupancy': {
      get: {
        tags: ['IPD'],
        summary: 'List the current truthful bed occupancy state across active inpatient admissions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current occupied beds ordered by assignedAt then id, including the minimal patient context needed for shell occupancy views.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IpdOccupancyEnvelope' },
              },
            },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/ipd/admissions/{admissionId}/movements': {
      get: {
        tags: ['IPD'],
        summary: 'List append-only bed movement history for one inpatient admission',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'admissionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Admission identifier.',
          },
        ],
        responses: {
          '200': {
            description: 'Movement history ordered by movedAt then id.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IpdMovementHistoryEnvelope' },
              },
            },
          },
          '400': {
            description: 'Path validation failed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '401': {
            description: 'Bearer token is missing, invalid, or expired.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '403': {
            description: 'Authenticated principal is not permitted to operate IPD lifecycle routes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '404': {
            description: 'Admission was not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
          '503': {
            description: 'IPD persistence is temporarily unavailable.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
  },
} as const;
