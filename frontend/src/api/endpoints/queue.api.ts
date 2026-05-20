import { ApiError, type ApiErrorCode, type createApiClient } from '@/api/client';
import { API_ENDPOINTS } from './api-endpoints';

const REQUEST_TIMEOUT_MS = 8_000;

type ApiClient = ReturnType<typeof createApiClient>;
type EnvelopeRecord = Record<string, unknown>;

type ActiveQueueStatus = 'SCHEDULED' | 'CHECKED_IN';
type QueueLifecycleStatus = ActiveQueueStatus | 'COMPLETED';
type NullableGender = 'FEMALE' | 'MALE' | 'OTHER' | 'UNSPECIFIED' | null;

export type DoctorQueuePatient = {
  id: string;
  registrationNumber: string;
  fullName: string;
  primaryPhone: string;
  dateOfBirth: string | null;
  gender: NullableGender;
};

export type DoctorQueueAppointment = {
  id: string;
  patientId: string;
  doctorUserId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: ActiveQueueStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  patient: DoctorQueuePatient;
};

export type QueueLifecycleAppointment = Omit<DoctorQueueAppointment, 'status'> & {
  status: QueueLifecycleStatus;
};

export type UpdateDoctorQueueAppointmentInput = {
  appointmentId: string;
  version: number;
  status: 'CHECKED_IN' | 'COMPLETED';
};

class MalformedEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEnvelopeError';
  }
}

export class QueueMutationRecoveryError extends ApiError {
  readonly forceInvalidate = true;

  constructor(message: string) {
    super(message, 503, 'UNAVAILABLE', true);
    this.name = 'QueueMutationRecoveryError';
  }
}

export async function listDoctorQueue(client: ApiClient): Promise<DoctorQueueAppointment[]> {
  try {
    const response = await withTimeout((signal) =>
      client.get<unknown>(API_ENDPOINTS.queue.doctorQueue, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseDoctorQueueEnvelope(response);
  } catch (error) {
    throw normalizeQueueError(error, 'Doctor queue lookup failed.');
  }
}

export async function updateDoctorQueueAppointment(
  client: ApiClient,
  input: UpdateDoctorQueueAppointmentInput,
): Promise<QueueLifecycleAppointment> {
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new ApiError('Queue update version is required.', 400, 'INVALID_QUEUE_VERSION');
  }

  if (input.status !== 'CHECKED_IN' && input.status !== 'COMPLETED') {
    throw new ApiError('Queue update target status is not supported.', 400, 'INVALID_QUEUE_STATUS');
  }

  try {
    const response = await withTimeout((signal) =>
      client.patch<unknown>(API_ENDPOINTS.queue.doctorQueueAppointment(input.appointmentId), {
        version: input.version,
        status: input.status,
      }, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseDoctorQueueMutationEnvelope(response);
  } catch (error) {
    throw normalizeQueueError(error, 'Doctor queue update failed.', {
      refetchAuthoritativeQueue: true,
    });
  }
}

export function shouldRecoverDoctorQueue(error: unknown): error is QueueMutationRecoveryError {
  return error instanceof QueueMutationRecoveryError && error.forceInvalidate;
}

function parseDoctorQueueEnvelope(payload: unknown): DoctorQueueAppointment[] {
  const data = readEnvelopeData(payload, 'doctor queue');

  if (!Array.isArray(data)) {
    throw new MalformedEnvelopeError('Doctor queue data must be an array.');
  }

  return data.map((entry, index) =>
    parseDoctorQueueQueryAppointment(entry, `doctor queue item ${index}`),
  );
}

function parseDoctorQueueMutationEnvelope(payload: unknown): QueueLifecycleAppointment {
  const data = readEnvelopeData(payload, 'doctor queue update');
  return parseDoctorQueueMutationAppointment(data, 'doctor queue update item');
}

function parseDoctorQueueQueryAppointment(
  value: unknown,
  context: string,
): DoctorQueueAppointment {
  const record = expectRecord(value, context);
  const status = expectString(record.status, `${context}.status`);

  if (!isActiveQueueStatus(status)) {
    throw new MalformedEnvelopeError(`${context}.status must be SCHEDULED or CHECKED_IN.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    patientId: expectString(record.patientId, `${context}.patientId`),
    doctorUserId: expectString(record.doctorUserId, `${context}.doctorUserId`),
    scheduledAt: expectString(record.scheduledAt, `${context}.scheduledAt`),
    durationMinutes: expectNumber(record.durationMinutes, `${context}.durationMinutes`),
    status,
    version: expectVersion(record.version, `${context}.version`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
    patient: parseDoctorQueuePatient(record.patient, `${context}.patient`),
  };
}

function parseDoctorQueueMutationAppointment(
  value: unknown,
  context: string,
): QueueLifecycleAppointment {
  const record = expectRecord(value, context);
  const status = expectString(record.status, `${context}.status`);

  if (!isQueueLifecycleStatus(status)) {
    throw new MalformedEnvelopeError(`${context}.status must be CHECKED_IN or COMPLETED.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    patientId: expectString(record.patientId, `${context}.patientId`),
    doctorUserId: expectString(record.doctorUserId, `${context}.doctorUserId`),
    scheduledAt: expectString(record.scheduledAt, `${context}.scheduledAt`),
    durationMinutes: expectNumber(record.durationMinutes, `${context}.durationMinutes`),
    status,
    version: expectVersion(record.version, `${context}.version`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
    patient: parseDoctorQueuePatient(record.patient, `${context}.patient`),
  };
}

function parseDoctorQueuePatient(value: unknown, context: string): DoctorQueuePatient {
  const record = expectRecord(value, context);

  return {
    id: expectString(record.id, `${context}.id`),
    registrationNumber: expectString(record.registrationNumber, `${context}.registrationNumber`),
    fullName: expectString(record.fullName, `${context}.fullName`),
    primaryPhone: expectString(record.primaryPhone, `${context}.primaryPhone`),
    dateOfBirth: readNullableString(record.dateOfBirth, `${context}.dateOfBirth`),
    gender: readNullableGender(record.gender, `${context}.gender`),
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

function expectVersion(value: unknown, context: string) {
  const version = expectNumber(value, context);

  if (!Number.isInteger(version) || version < 1) {
    throw new MalformedEnvelopeError(`${context} must be a positive integer.`);
  }

  return version;
}

function readNullableString(value: unknown, context: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return expectString(value, context);
}

function readNullableGender(value: unknown, context: string): NullableGender {
  if (value === null || value === undefined) {
    return null;
  }

  const gender = expectString(value, context);

  if (gender === 'FEMALE' || gender === 'MALE' || gender === 'OTHER' || gender === 'UNSPECIFIED') {
    return gender;
  }

  throw new MalformedEnvelopeError(`${context} was not recognized.`);
}

function isActiveQueueStatus(value: string): value is ActiveQueueStatus {
  return value === 'SCHEDULED' || value === 'CHECKED_IN';
}

function isQueueLifecycleStatus(value: string): value is QueueLifecycleStatus {
  return value === 'CHECKED_IN' || value === 'COMPLETED';
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

function normalizeQueueError(
  error: unknown,
  fallbackMessage: string,
  options: { refetchAuthoritativeQueue?: boolean } = {},
) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof MalformedEnvelopeError) {
    if (options.refetchAuthoritativeQueue) {
      return new QueueMutationRecoveryError(error.message);
    }

    return new ApiError(error.message, 503, 'UNAVAILABLE', true);
  }

  if (error instanceof SyntaxError) {
    if (options.refetchAuthoritativeQueue) {
      return new QueueMutationRecoveryError('The backend returned malformed JSON.');
    }

    return new ApiError('The backend returned malformed JSON.', 503, 'UNAVAILABLE', true);
  }

  if (isAbortError(error)) {
    return new ApiError(fallbackMessage, 503, 'UNAVAILABLE', true);
  }

  if (error instanceof TypeError) {
    return new ApiError(fallbackMessage, 503, 'UNAVAILABLE', true);
  }

  return new ApiError(fallbackMessage, 500, 'UNKNOWN_ERROR' satisfies ApiErrorCode);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
