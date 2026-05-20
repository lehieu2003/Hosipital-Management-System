import { ApiError, type ApiErrorCode, type createApiClient } from '@/api/client';
import { API_ENDPOINTS } from './api-endpoints';

type ApiClient = ReturnType<typeof createApiClient>;
type EnvelopeRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 8_000;

export type IpdOperatorRole = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR';
export type IpdAdmissionStatus = 'ADMITTED' | 'DISCHARGED';
export type IpdMovementType = 'ASSIGNED' | 'TRANSFERRED' | 'DISCHARGED';

export type IpdBed = {
  id: string;
  bedNumber: string;
  wardName: string;
  roomNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IpdOperator = {
  id: string;
  username: string;
  role: IpdOperatorRole;
  isActive: boolean;
};

export type IpdCurrentBedOccupancy = {
  id: string;
  admissionId: string;
  bedId: string;
  assignedByUserId: string;
  assignedAt: string;
  lastTransferredAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  bed: IpdBed;
  assignedByUser: IpdOperator;
};

export type IpdAdmission = {
  id: string;
  patientId: string;
  status: IpdAdmissionStatus;
  attendingDoctorUserId: string | null;
  admittedByUserId: string;
  admittedAt: string;
  dischargeAt: string | null;
  dischargeNotes: string | null;
  dischargedByUserId: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  currentBedOccupancy: IpdCurrentBedOccupancy | null;
};

export type IpdBedMovement = {
  id: string;
  admissionId: string;
  movementType: IpdMovementType;
  fromBedId: string | null;
  toBedId: string | null;
  movedByUserId: string;
  movedAt: string;
  note: string | null;
  createdAt: string;
  fromBed: IpdBed | null;
  toBed: IpdBed | null;
  movedByUser: IpdOperator;
};

export type IpdAdmissionActionResult = {
  admission: IpdAdmission;
  movement: IpdBedMovement | null;
};

export type IpdOccupancyEntry = {
  id: string;
  admissionId: string;
  bedId: string;
  assignedByUserId: string;
  assignedAt: string;
  lastTransferredAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  bed: IpdBed;
  assignedByUser: IpdOperator;
  admission: {
    id: string;
    patientId: string;
    status: IpdAdmissionStatus;
    admittedAt: string;
    dischargeAt: string | null;
    version: number;
    patient: {
      id: string;
      registrationNumber: string;
      fullName: string;
      primaryPhone: string;
    };
  };
};

export type AdmitPatientInput = {
  patientId: string;
  attendingDoctorUserId?: string | null;
  notes?: string | null;
};

export type AssignBedInput = {
  admissionId: string;
  bedId: string;
  expectedAdmissionVersion: number;
  note?: string | null;
};

export type TransferBedInput = {
  admissionId: string;
  targetBedId: string;
  expectedAdmissionVersion: number;
  expectedOccupancyVersion: number;
  note?: string | null;
};

export type DischargeAdmissionInput = {
  admissionId: string;
  expectedAdmissionVersion: number;
  expectedOccupancyVersion?: number;
  dischargeNotes?: string | null;
  movementNote?: string | null;
};

class MalformedEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEnvelopeError';
  }
}

export async function admitPatient(
  client: ApiClient,
  input: AdmitPatientInput,
): Promise<IpdAdmission> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.ipd.admissions, input, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseAdmission(readEnvelopeData(response, 'ipd admission create'), 'ipd admission create data');
  } catch (error) {
    throw normalizeIpdError(error, 'Inpatient admission failed.');
  }
}

export async function assignBed(
  client: ApiClient,
  input: AssignBedInput,
): Promise<IpdAdmissionActionResult> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.ipd.admissionBedAssignment(input.admissionId), {
        bedId: input.bedId,
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        note: input.note ?? null,
      }, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseAdmissionActionResult(readEnvelopeData(response, 'ipd bed assignment'), 'ipd bed assignment data');
  } catch (error) {
    throw normalizeIpdError(error, 'Bed assignment failed.');
  }
}

export async function transferBed(
  client: ApiClient,
  input: TransferBedInput,
): Promise<IpdAdmissionActionResult> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.ipd.admissionBedTransfer(input.admissionId), {
        targetBedId: input.targetBedId,
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        expectedOccupancyVersion: input.expectedOccupancyVersion,
        note: input.note ?? null,
      }, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseAdmissionActionResult(readEnvelopeData(response, 'ipd bed transfer'), 'ipd bed transfer data');
  } catch (error) {
    throw normalizeIpdError(error, 'Bed transfer failed.');
  }
}

export async function dischargeAdmission(
  client: ApiClient,
  input: DischargeAdmissionInput,
): Promise<IpdAdmissionActionResult> {
  try {
    const response = await withTimeout((signal) =>
      client.post<unknown>(API_ENDPOINTS.ipd.admissionDischarge(input.admissionId), {
        expectedAdmissionVersion: input.expectedAdmissionVersion,
        expectedOccupancyVersion: input.expectedOccupancyVersion,
        dischargeNotes: input.dischargeNotes ?? null,
        movementNote: input.movementNote ?? null,
      }, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    return parseAdmissionActionResult(readEnvelopeData(response, 'ipd discharge'), 'ipd discharge data');
  } catch (error) {
    throw normalizeIpdError(error, 'Inpatient discharge failed.');
  }
}

export async function listCurrentOccupancy(client: ApiClient): Promise<IpdOccupancyEntry[]> {
  try {
    const response = await withTimeout((signal) =>
      client.get<unknown>(API_ENDPOINTS.ipd.occupancy, {
        replayAfterRefresh: true,
        signal,
      }),
    );

    const data = readEnvelopeData(response, 'ipd occupancy');
    if (!Array.isArray(data)) {
      throw new MalformedEnvelopeError('IPD occupancy data must be an array.');
    }

    return data.map((entry, index) => parseOccupancyEntry(entry, `ipd occupancy entry ${index}`));
  } catch (error) {
    throw normalizeIpdError(error, 'IPD occupancy lookup failed.');
  }
}

export async function listAdmissionMovements(
  client: ApiClient,
  admissionId: string,
): Promise<IpdBedMovement[]> {
  try {
    const response = await withTimeout((signal) =>
      client.get<unknown>(API_ENDPOINTS.ipd.admissionMovements(admissionId), {
        replayAfterRefresh: true,
        signal,
      }),
    );

    const data = readEnvelopeData(response, 'ipd movement history');
    if (!Array.isArray(data)) {
      throw new MalformedEnvelopeError('IPD movement history data must be an array.');
    }

    return data.map((entry, index) => parseMovement(entry, `ipd movement history entry ${index}`));
  } catch (error) {
    throw normalizeIpdError(error, 'IPD movement history lookup failed.');
  }
}

function parseAdmissionActionResult(payload: unknown, context: string): IpdAdmissionActionResult {
  const record = expectRecord(payload, context);

  return {
    admission: parseAdmission(record.admission, `${context}.admission`),
    movement: record.movement === null ? null : parseMovement(record.movement, `${context}.movement`),
  };
}

function parseAdmission(payload: unknown, context: string): IpdAdmission {
  const record = expectRecord(payload, context);
  const status = expectString(record.status, `${context}.status`);

  if (status !== 'ADMITTED' && status !== 'DISCHARGED') {
    throw new MalformedEnvelopeError(`${context}.status was not recognized.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    patientId: expectString(record.patientId, `${context}.patientId`),
    status,
    attendingDoctorUserId: readNullableString(record.attendingDoctorUserId, `${context}.attendingDoctorUserId`),
    admittedByUserId: expectString(record.admittedByUserId, `${context}.admittedByUserId`),
    admittedAt: expectString(record.admittedAt, `${context}.admittedAt`),
    dischargeAt: readNullableString(record.dischargeAt, `${context}.dischargeAt`),
    dischargeNotes: readNullableString(record.dischargeNotes, `${context}.dischargeNotes`),
    dischargedByUserId: readNullableString(record.dischargedByUserId, `${context}.dischargedByUserId`),
    notes: readNullableString(record.notes, `${context}.notes`),
    version: expectNumber(record.version, `${context}.version`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
    currentBedOccupancy: record.currentBedOccupancy === null
      ? null
      : parseCurrentBedOccupancy(record.currentBedOccupancy, `${context}.currentBedOccupancy`),
  };
}

function parseCurrentBedOccupancy(payload: unknown, context: string): IpdCurrentBedOccupancy {
  const record = expectRecord(payload, context);

  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    bedId: expectString(record.bedId, `${context}.bedId`),
    assignedByUserId: expectString(record.assignedByUserId, `${context}.assignedByUserId`),
    assignedAt: expectString(record.assignedAt, `${context}.assignedAt`),
    lastTransferredAt: readNullableString(record.lastTransferredAt, `${context}.lastTransferredAt`),
    version: expectNumber(record.version, `${context}.version`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
    bed: parseBed(record.bed, `${context}.bed`),
    assignedByUser: parseOperator(record.assignedByUser, `${context}.assignedByUser`),
  };
}

function parseOccupancyEntry(payload: unknown, context: string): IpdOccupancyEntry {
  const record = expectRecord(payload, context);
  const admission = expectRecord(record.admission, `${context}.admission`);
  const patient = expectRecord(admission.patient, `${context}.admission.patient`);
  const status = expectString(admission.status, `${context}.admission.status`);

  if (status !== 'ADMITTED' && status !== 'DISCHARGED') {
    throw new MalformedEnvelopeError(`${context}.admission.status was not recognized.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    bedId: expectString(record.bedId, `${context}.bedId`),
    assignedByUserId: expectString(record.assignedByUserId, `${context}.assignedByUserId`),
    assignedAt: expectString(record.assignedAt, `${context}.assignedAt`),
    lastTransferredAt: readNullableString(record.lastTransferredAt, `${context}.lastTransferredAt`),
    version: expectNumber(record.version, `${context}.version`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
    bed: parseBed(record.bed, `${context}.bed`),
    assignedByUser: parseOperator(record.assignedByUser, `${context}.assignedByUser`),
    admission: {
      id: expectString(admission.id, `${context}.admission.id`),
      patientId: expectString(admission.patientId, `${context}.admission.patientId`),
      status,
      admittedAt: expectString(admission.admittedAt, `${context}.admission.admittedAt`),
      dischargeAt: readNullableString(admission.dischargeAt, `${context}.admission.dischargeAt`),
      version: expectNumber(admission.version, `${context}.admission.version`),
      patient: {
        id: expectString(patient.id, `${context}.admission.patient.id`),
        registrationNumber: expectString(patient.registrationNumber, `${context}.admission.patient.registrationNumber`),
        fullName: expectString(patient.fullName, `${context}.admission.patient.fullName`),
        primaryPhone: expectString(patient.primaryPhone, `${context}.admission.patient.primaryPhone`),
      },
    },
  };
}

function parseMovement(payload: unknown, context: string): IpdBedMovement {
  const record = expectRecord(payload, context);
  const movementType = expectString(record.movementType, `${context}.movementType`);

  if (movementType !== 'ASSIGNED' && movementType !== 'TRANSFERRED' && movementType !== 'DISCHARGED') {
    throw new MalformedEnvelopeError(`${context}.movementType was not recognized.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    movementType,
    fromBedId: readNullableString(record.fromBedId, `${context}.fromBedId`),
    toBedId: readNullableString(record.toBedId, `${context}.toBedId`),
    movedByUserId: expectString(record.movedByUserId, `${context}.movedByUserId`),
    movedAt: expectString(record.movedAt, `${context}.movedAt`),
    note: readNullableString(record.note, `${context}.note`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    fromBed: record.fromBed === null ? null : parseBed(record.fromBed, `${context}.fromBed`),
    toBed: record.toBed === null ? null : parseBed(record.toBed, `${context}.toBed`),
    movedByUser: parseOperator(record.movedByUser, `${context}.movedByUser`),
  };
}

function parseBed(payload: unknown, context: string): IpdBed {
  const record = expectRecord(payload, context);

  return {
    id: expectString(record.id, `${context}.id`),
    bedNumber: expectString(record.bedNumber, `${context}.bedNumber`),
    wardName: expectString(record.wardName, `${context}.wardName`),
    roomNumber: expectString(record.roomNumber, `${context}.roomNumber`),
    isActive: expectBoolean(record.isActive, `${context}.isActive`),
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
  };
}

function parseOperator(payload: unknown, context: string): IpdOperator {
  const record = expectRecord(payload, context);
  const role = expectString(record.role, `${context}.role`);

  if (role !== 'ADMIN' && role !== 'RECEPTIONIST' && role !== 'DOCTOR') {
    throw new MalformedEnvelopeError(`${context}.role was not recognized.`);
  }

  return {
    id: expectString(record.id, `${context}.id`),
    username: expectString(record.username, `${context}.username`),
    role,
    isActive: expectBoolean(record.isActive, `${context}.isActive`),
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

function expectBoolean(value: unknown, context: string) {
  if (typeof value !== 'boolean') {
    throw new MalformedEnvelopeError(`${context} must be a boolean.`);
  }

  return value;
}

function readNullableString(value: unknown, context: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return expectString(value, context);
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

function normalizeIpdError(error: unknown, fallbackMessage: string) {
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
