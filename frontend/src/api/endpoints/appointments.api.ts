import { ApiError, type ApiErrorCode, type RequestOptions, type createApiClient } from '@/api/client';
import { API_ENDPOINTS } from './api-endpoints';

const REQUEST_TIMEOUT_MS = 8_000;

type ApiClient = ReturnType<typeof createApiClient>;
type EnvelopeRecord = Record<string, unknown>;

type NullableGender = 'FEMALE' | 'MALE' | 'OTHER' | 'UNSPECIFIED' | null;

export type SchedulableDoctor = {
  id: string;
  username: string;
  departmentId: string;
  departmentName: string;
};

export type CreatePatientInput = {
  fullName: string;
  primaryPhone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: NullableGender;
  address: string | null;
};

export type RegisteredPatient = {
  id: string;
  registrationNumber: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: NullableGender;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAppointmentInput = {
  patientId: string;
  doctorUserId: string;
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
};

export type ScheduledAppointment = {
  id: string;
  patientId: string;
  doctorUserId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleAppointmentInput = {
  patient: CreatePatientInput;
  appointment: Omit<CreateAppointmentInput, 'patientId'>;
};

export type ScheduleAppointmentResult = {
  patient: RegisteredPatient;
  appointment: ScheduledAppointment;
};

class MalformedEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEnvelopeError';
  }
}

export async function listSchedulableDoctors(client: ApiClient): Promise<SchedulableDoctor[]> {
  try {
    const response = await withTimeout((signal) =>
      client.get<unknown>(API_ENDPOINTS.appointments.doctors, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseDoctorDirectoryEnvelope(response);
  } catch (error) {
    throw normalizeSchedulingError(error, 'Doctor directory lookup failed.');
  }
}

export async function registerPatient(
  client: ApiClient,
  input: CreatePatientInput,
): Promise<RegisteredPatient> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.appointments.patients, input, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parsePatientEnvelope(response);
  } catch (error) {
    throw normalizeSchedulingError(error, 'Patient registration failed.');
  }
}

export async function createAppointment(
  client: ApiClient,
  input: CreateAppointmentInput,
): Promise<ScheduledAppointment> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.appointments.collection, input, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseAppointmentEnvelope(response);
  } catch (error) {
    throw normalizeSchedulingError(error, 'Appointment booking failed.');
  }
}

export async function scheduleAppointment(
  client: ApiClient,
  input: ScheduleAppointmentInput,
): Promise<ScheduleAppointmentResult> {
  const patient = await registerPatient(client, input.patient);
  const appointment = await createAppointment(client, {
    ...input.appointment,
    patientId: patient.id,
  });

  return {
    patient,
    appointment,
  };
}

function parseDoctorDirectoryEnvelope(payload: unknown) {
  const data = readEnvelopeData(payload, 'doctor directory');

  if (!Array.isArray(data)) {
    throw new MalformedEnvelopeError('Doctor directory data must be an array.');
  }

  return data.map((entry, index) => {
    const record = expectRecord(entry, `doctor directory entry ${index}`);
    return {
      id: expectString(record.id, `doctor directory entry ${index}.id`),
      username: expectString(record.username, `doctor directory entry ${index}.username`),
      departmentId: expectString(record.departmentId, `doctor directory entry ${index}.departmentId`),
      departmentName: expectString(record.departmentName, `doctor directory entry ${index}.departmentName`),
    } satisfies SchedulableDoctor;
  });
}

function parsePatientEnvelope(payload: unknown): RegisteredPatient {
  const data = expectRecord(readEnvelopeData(payload, 'patient create'), 'patient create data');

  return {
    id: expectString(data.id, 'patient.id'),
    registrationNumber: expectString(data.registrationNumber, 'patient.registrationNumber'),
    fullName: expectString(data.fullName, 'patient.fullName'),
    primaryPhone: expectString(data.primaryPhone, 'patient.primaryPhone'),
    email: readNullableString(data.email, 'patient.email'),
    dateOfBirth: readNullableString(data.dateOfBirth, 'patient.dateOfBirth'),
    gender: readNullableGender(data.gender, 'patient.gender'),
    address: readNullableString(data.address, 'patient.address'),
    createdAt: expectString(data.createdAt, 'patient.createdAt'),
    updatedAt: expectString(data.updatedAt, 'patient.updatedAt'),
  };
}

function parseAppointmentEnvelope(payload: unknown): ScheduledAppointment {
  const data = expectRecord(readEnvelopeData(payload, 'appointment create'), 'appointment create data');
  const status = expectString(data.status, 'appointment.status');

  if (!isAppointmentStatus(status)) {
    throw new MalformedEnvelopeError('Appointment status was not recognized.');
  }

  return {
    id: expectString(data.id, 'appointment.id'),
    patientId: expectString(data.patientId, 'appointment.patientId'),
    doctorUserId: expectString(data.doctorUserId, 'appointment.doctorUserId'),
    scheduledAt: expectString(data.scheduledAt, 'appointment.scheduledAt'),
    durationMinutes: expectNumber(data.durationMinutes, 'appointment.durationMinutes'),
    status,
    notes: readNullableString(data.notes, 'appointment.notes'),
    version: expectNumber(data.version, 'appointment.version'),
    createdAt: expectString(data.createdAt, 'appointment.createdAt'),
    updatedAt: expectString(data.updatedAt, 'appointment.updatedAt'),
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

function isAppointmentStatus(
  value: string,
): value is ScheduledAppointment['status'] {
  return (
    value === 'SCHEDULED' ||
    value === 'CHECKED_IN' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED' ||
    value === 'NO_SHOW'
  );
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

function normalizeSchedulingError(error: unknown, fallbackMessage: string) {
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

export function withJsonRequestOptions(options: RequestOptions = {}): RequestOptions {
  return {
    replayAfterRefresh: true,
    ...options,
  };
}
