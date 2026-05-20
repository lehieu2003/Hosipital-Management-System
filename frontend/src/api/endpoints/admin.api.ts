import { ApiError, type ApiErrorCode, type createApiClient } from '@/api/client';
import { API_ENDPOINTS } from './api-endpoints';

type ApiClient = ReturnType<typeof createApiClient>;
type EnvelopeRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 8_000;

export type AdminAssignedDoctor = {
  id: string;
  username: string;
};

export type AdminDepartment = {
  id: string;
  name: string;
  assignmentCount: number;
  assignedDoctor: AdminAssignedDoctor | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDepartmentInput = {
  name: string;
};

export type AssignDepartmentDoctorInput = {
  departmentId: string;
  doctorUserId: string;
};

class MalformedEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEnvelopeError';
  }
}

export async function listAdminDepartments(client: ApiClient): Promise<AdminDepartment[]> {
  try {
    const response = await withTimeout((signal) =>
      client.get<unknown>(API_ENDPOINTS.admin.departments, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    const data = readEnvelopeData(response, 'admin departments');
    if (!Array.isArray(data)) {
      throw new MalformedEnvelopeError('Admin departments data must be an array.');
    }

    return data.map((entry, index) => parseDepartment(entry, `admin departments entry ${index}`));
  } catch (error) {
    throw normalizeAdminConfigError(error, 'Department configuration lookup failed.');
  }
}

export async function createDepartment(
  client: ApiClient,
  input: CreateDepartmentInput,
): Promise<AdminDepartment> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.admin.departments, input, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseDepartment(readEnvelopeData(response, 'admin department create'), 'admin department create data');
  } catch (error) {
    throw normalizeAdminConfigError(error, 'Department creation failed.');
  }
}

export async function assignDepartmentDoctor(
  client: ApiClient,
  input: AssignDepartmentDoctorInput,
): Promise<AdminDepartment> {
  try {
    const response = await withTimeout((signal) =>
      client.request<unknown>(API_ENDPOINTS.admin.departmentDoctorAssignment(input.departmentId), {
        body: {
          doctorUserId: input.doctorUserId,
        },
        method: 'PUT',
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseDepartment(readEnvelopeData(response, 'admin doctor assignment'), 'admin doctor assignment data');
  } catch (error) {
    throw normalizeAdminConfigError(error, 'Doctor assignment failed.');
  }
}

function parseDepartment(payload: unknown, context: string): AdminDepartment {
  const record = expectRecord(payload, context);

  return {
    id: expectString(record.id, `${context}.id`),
    name: expectString(record.name, `${context}.name`),
    assignmentCount: expectNumber(record.assignmentCount, `${context}.assignmentCount`),
    assignedDoctor: parseAssignedDoctor(record.assignedDoctor, `${context}.assignedDoctor`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
  };
}

function parseAssignedDoctor(value: unknown, context: string): AdminAssignedDoctor | null {
  if (value === null || value === undefined) {
    return null;
  }

  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    username: expectString(record.username, `${context}.username`),
  };
}

function readEnvelopeData(payload: unknown, context: string) {
  const record = expectRecord(payload, `${context} envelope`);

  if (record.success !== true) {
    throw new MalformedEnvelopeError(`${context} envelope must declare success=true.`);
  }

  if (!('data' in record)) {
    throw new MalformedEnvelopeError(`${context} envelope is missing data.`);
  }

  return record.data;
}

function expectRecord(value: unknown, context: string): EnvelopeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MalformedEnvelopeError(`${context} must be an object.`);
  }

  return value as EnvelopeRecord;
}

function expectString(value: unknown, context: string) {
  if (typeof value !== 'string') {
    throw new MalformedEnvelopeError(`${context} must be a string.`);
  }

  return value;
}

function expectNumber(value: unknown, context: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new MalformedEnvelopeError(`${context} must be a number.`);
  }

  return value;
}

async function withTimeout<T>(
  requestFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestFactory(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeAdminConfigError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof MalformedEnvelopeError) {
    return new ApiError(error.message, 503, 'UNAVAILABLE', true);
  }

  if (isAbortError(error)) {
    return new ApiError(fallbackMessage, 503, 'UNAVAILABLE', true);
  }

  if (error instanceof TypeError) {
    return new ApiError(fallbackMessage, 503, 'UNAVAILABLE', true);
  }

  if (error instanceof SyntaxError) {
    return new ApiError('The backend returned malformed JSON.', 503, 'UNAVAILABLE', true);
  }

  return new ApiError(fallbackMessage, 500, 'UNKNOWN_ERROR' satisfies ApiErrorCode);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
