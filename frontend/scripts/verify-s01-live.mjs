#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const SESSION_STORAGE_KEY = 'hms.frontend.session';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const BACKEND_ROOT = path.resolve(PROJECT_ROOT, 'node-backend');
const BACKEND_ENV_PATH = path.resolve(BACKEND_ROOT, '.env');

loadEnvFile(BACKEND_ENV_PATH);

const frontendUrl = normalizeUrl(process.env.S01_FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL);
const apiBaseUrl = normalizeUrl(
  process.env.S01_API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);
const timeoutMs = Number(process.env.S01_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

const backendRequire = createRequire(path.resolve(BACKEND_ROOT, 'package.json'));
const { PrismaClient } = backendRequire('@prisma/client');

const verificationState = {
  currentPhase: 'bootstrap',
  lastSuccessfulPhase: null,
  evidence: {},
};

async function main() {
  assertTimeout(timeoutMs);

  emit('config', {
    verifier: 'S01',
    frontendUrl,
    apiBaseUrl,
    timeoutMs,
    bootstrap: {
      seedsBedFixturesViaPrisma: true,
      drivesLifecycleViaHttp: true,
    },
    redaction: {
      hides: ['accessToken', 'refreshCookie', 'patientFullName', 'patientPhone', 'patientEmail'],
    },
  });

  await phase('readiness.backend-health', async () => {
    await waitForJsonEndpoint({
      description: 'backend-health',
      expect: expectHealthPayload,
      path: '/healthz',
    });
    emit('ready', { target: 'backend-health', status: 'ok' });
  });

  await phase('readiness.frontend-landing', async () => {
    await waitForHtmlPage({
      description: 'frontend-landing',
      path: '/',
    });
    emit('ready', { target: 'frontend-landing', status: 'ok' });
  });

  await phase('readiness.frontend-login', async () => {
    await waitForHtmlPage({
      description: 'frontend-login',
      path: '/login',
    });
    emit('ready', { target: 'frontend-login', status: 'ok' });
  });

  const verification = await verifyIpdLifecycle();
  emitBrowserChecklist(verification);
  emit('result', {
    verifier: 'S01',
    status: 'ok',
    lastSuccessfulPhase: verificationState.lastSuccessfulPhase,
    proof: sanitizedEvidence(),
    proves: [
      'Reception can create live patients, admit them, assign beds, transfer beds, and discharge safely through the dedicated /api/v1/ipd contract.',
      'Current occupancy remains truthful before and after transfer/discharge, and append-only movement history exposes assigned, transferred, and discharged evidence.',
      'A live occupied-target transfer returns HTTP 409 with BED_OCCUPANCY_CONFLICT instead of collapsing into a false success state.',
      'The React shell exposes dedicated ready, success, conflict, history, and unavailable selectors through a replayable receptionist browser checklist.',
    ],
    historicalNote:
      'This verifier supersedes manual slice-demo probing by provisioning live bed fixtures when the dev database is empty and capturing replayable shell assertions for the receptionist IPD lifecycle.',
  });
}

async function verifyIpdLifecycle() {
  const probeId = randomUUID().slice(0, 8);
  const receptionist = await phase('auth.reception-login', () => loginUser('reception', 'secret123'));
  const doctor = await phase('auth.doctor-login', () => loginUser('doctor', 'secret123'));
  const beds = await phase('bootstrap.bed-fixtures', () => ensureBedFixtures(probeId));

  const patientOne = await phase('patients.create-first', () =>
    createPatient(receptionist.accessToken, {
      fullName: `S01 Live ${probeId} Alpha`,
      primaryPhone: uniquePhone('41'),
      email: `s01-live-${probeId}-alpha@example.test`,
      dateOfBirth: '1990-04-12',
      gender: 'FEMALE',
    }),
  );

  const patientTwo = await phase('patients.create-second', () =>
    createPatient(receptionist.accessToken, {
      fullName: `S01 Live ${probeId} Bravo`,
      primaryPhone: uniquePhone('52'),
      email: `s01-live-${probeId}-bravo@example.test`,
      dateOfBirth: '1988-09-22',
      gender: 'MALE',
    }),
  );

  const admissionOne = await phase('ipd.admit-first', () =>
    createAdmission(receptionist.accessToken, {
      patientId: patientOne.id,
      attendingDoctorUserId: doctor.userId,
      notes: `S01 verifier observation ${probeId}`,
    }),
  );

  const assignmentOne = await phase('ipd.assign-first-bed', () =>
    assignBed(receptionist.accessToken, {
      admissionId: admissionOne.id,
      bedId: beds.primary.id,
      expectedAdmissionVersion: admissionOne.version,
      note: `Initial assignment ${probeId}`,
    }),
  );

  await phase('ipd.occupancy-after-first-assignment', async () => {
    const occupancy = await listOccupancy(receptionist.accessToken);
    const row = findOccupancyByAdmissionId(occupancy, admissionOne.id, 'occupancy after first assignment');
    assertEqual(row.bed.id, beds.primary.id, 'First admission did not occupy the primary bed.');
    assertEqual(row.version, 1, 'First assignment should start occupancy versioning at 1.');
    verificationState.evidence.firstAssignmentOccupancyId = row.id;
    emit('check', {
      check: 'ipd-occupancy-after-first-assignment',
      status: 'ok',
      occupancyId: row.id,
      admissionId: row.admission.id,
      bedId: row.bed.id,
      bedNumber: row.bed.bedNumber,
      occupancyVersion: row.version,
    });
  });

  await phase('ipd.history-after-first-assignment', async () => {
    const history = await listMovements(receptionist.accessToken, admissionOne.id);
    assertEqual(history.length, 1, 'Expected one movement after the initial bed assignment.');
    assertEqual(history[0].movementType, 'ASSIGNED', 'First movement should be ASSIGNED.');
    assertEqual(history[0].toBed?.id, beds.primary.id, 'Assigned movement should target the primary bed.');
    verificationState.evidence.assignedMovementId = history[0].id;
    emit('check', {
      check: 'ipd-history-after-first-assignment',
      status: 'ok',
      movementId: history[0].id,
      movementType: history[0].movementType,
      toBedId: history[0].toBed?.id ?? null,
    });
  });

  const transferOne = await phase('ipd.transfer-first-to-secondary', () =>
    transferBed(receptionist.accessToken, {
      admissionId: assignmentOne.admission.id,
      targetBedId: beds.secondary.id,
      expectedAdmissionVersion: assignmentOne.admission.version,
      expectedOccupancyVersion: expectOccupancyVersion(assignmentOne.admission.currentBedOccupancy, 'first transfer'),
      note: `Escalated to monitored room ${probeId}`,
    }),
  );

  await phase('ipd.occupancy-after-transfer', async () => {
    const occupancy = await listOccupancy(receptionist.accessToken);
    const row = findOccupancyByAdmissionId(occupancy, admissionOne.id, 'occupancy after transfer');
    assertEqual(row.bed.id, beds.secondary.id, 'Transferred admission did not move to the secondary bed.');
    assertEqual(row.version, 2, 'Transfer should increment occupancy version to 2.');
    verificationState.evidence.transferredOccupancyId = row.id;
    emit('check', {
      check: 'ipd-occupancy-after-transfer',
      status: 'ok',
      occupancyId: row.id,
      admissionId: row.admission.id,
      bedId: row.bed.id,
      bedNumber: row.bed.bedNumber,
      occupancyVersion: row.version,
    });
  });

  const admissionTwo = await phase('ipd.admit-second', () => createAdmission(receptionist.accessToken, { patientId: patientTwo.id }));

  const assignmentTwo = await phase('ipd.assign-second-to-primary', () =>
    assignBed(receptionist.accessToken, {
      admissionId: admissionTwo.id,
      bedId: beds.primary.id,
      expectedAdmissionVersion: admissionTwo.version,
      note: `Secondary live assignment ${probeId}`,
    }),
  );

  const conflict = await phase('ipd.transfer-conflict', async () => {
    const response = await fetchJson(`${apiBaseUrl}/ipd/admissions/${assignmentTwo.admission.id}/bed-transfer`, {
      method: 'POST',
      headers: jsonHeaders(receptionist.accessToken),
      body: JSON.stringify({
        targetBedId: beds.secondary.id,
        expectedAdmissionVersion: assignmentTwo.admission.version,
        expectedOccupancyVersion: expectOccupancyVersion(assignmentTwo.admission.currentBedOccupancy, 'conflict transfer'),
        note: `Conflict retry ${probeId}`,
      }),
    });

    assertStatus(response.response.status, 409, 'Expected occupied-target transfer to fail with HTTP 409.');
    assertErrorCode(response.payload, 'BED_OCCUPANCY_CONFLICT', 'occupied-target bed transfer conflict');
    emit('check', {
      check: 'ipd-occupied-target-conflict',
      status: 'ok',
      errorCode: 'BED_OCCUPANCY_CONFLICT',
      admissionId: assignmentTwo.admission.id,
      occupiedBedId: beds.secondary.id,
      occupiedBedNumber: beds.secondary.bedNumber,
    });

    return {
      admissionId: assignmentTwo.admission.id,
      expectedAdmissionVersion: assignmentTwo.admission.version,
      expectedOccupancyVersion: expectOccupancyVersion(assignmentTwo.admission.currentBedOccupancy, 'conflict transfer evidence'),
      bedId: beds.secondary.id,
      payload: response.payload,
    };
  });

  const dischargeOne = await phase('ipd.discharge-first', () =>
    dischargeAdmission(receptionist.accessToken, {
      admissionId: transferOne.admission.id,
      expectedAdmissionVersion: transferOne.admission.version,
      expectedOccupancyVersion: expectOccupancyVersion(transferOne.admission.currentBedOccupancy, 'discharge'),
      dischargeNotes: `Recovered and sent home ${probeId}`,
      movementNote: `Bed released after discharge ${probeId}`,
    }),
  );

  await phase('ipd.occupancy-after-discharge', async () => {
    const occupancy = await listOccupancy(receptionist.accessToken);
    const dischargedStillPresent = occupancy.some((entry) => entry.admission.id === admissionOne.id);
    if (dischargedStillPresent) {
      throw new Error('Discharged admission still appeared in live occupancy.');
    }

    const remaining = findOccupancyByAdmissionId(occupancy, admissionTwo.id, 'occupancy after discharge');
    assertEqual(remaining.bed.id, beds.primary.id, 'Second admission should remain on the primary bed after discharge.');
    verificationState.evidence.remainingOccupancyId = remaining.id;
    emit('check', {
      check: 'ipd-occupancy-after-discharge',
      status: 'ok',
      remainingOccupancyId: remaining.id,
      remainingAdmissionId: remaining.admission.id,
      bedId: remaining.bed.id,
      bedNumber: remaining.bed.bedNumber,
    });
  });

  const finalHistory = await phase('ipd.history-after-discharge', async () => {
    const history = await listMovements(receptionist.accessToken, admissionOne.id);
    const movementTypes = history.map((entry) => entry.movementType);
    assertEqual(history.length, 3, 'Expected three history entries after transfer and discharge.');
    assertDeepEqual(
      movementTypes,
      ['ASSIGNED', 'TRANSFERRED', 'DISCHARGED'],
      'Movement history did not preserve the expected append-only sequence.',
    );

    const dischargedMovement = history[2];
    assertEqual(dischargedMovement.fromBed?.id, beds.secondary.id, 'Discharge movement should release the secondary bed.');
    if (dischargedMovement.toBed !== null) {
      throw new Error('Discharge movement should not retain a target bed.');
    }

    verificationState.evidence.dischargeMovementId = dischargedMovement.id;
    emit('check', {
      check: 'ipd-history-after-discharge',
      status: 'ok',
      movementIds: history.map((entry) => entry.id),
      movementTypes,
      dischargeMovementId: dischargedMovement.id,
    });

    return history;
  });

  verificationState.evidence.receptionistUserId = receptionist.userId;
  verificationState.evidence.receptionistUsername = receptionist.username;
  verificationState.evidence.doctorUserId = doctor.userId;
  verificationState.evidence.doctorUsername = doctor.username;
  verificationState.evidence.firstPatientId = patientOne.id;
  verificationState.evidence.firstPatientRegistrationNumber = patientOne.registrationNumber;
  verificationState.evidence.secondPatientId = patientTwo.id;
  verificationState.evidence.secondPatientRegistrationNumber = patientTwo.registrationNumber;
  verificationState.evidence.firstAdmissionId = dischargeOne.admission.id;
  verificationState.evidence.firstAdmissionVersion = dischargeOne.admission.version;
  verificationState.evidence.secondAdmissionId = assignmentTwo.admission.id;
  verificationState.evidence.secondAdmissionVersion = assignmentTwo.admission.version;
  verificationState.evidence.primaryBedId = beds.primary.id;
  verificationState.evidence.primaryBedNumber = beds.primary.bedNumber;
  verificationState.evidence.secondaryBedId = beds.secondary.id;
  verificationState.evidence.secondaryBedNumber = beds.secondary.bedNumber;
  verificationState.evidence.conflictCode = readErrorCode(conflict.payload, 'conflict payload');

  return {
    receptionist,
    doctor,
    beds,
    patientOne,
    patientTwo,
    admissionOne: dischargeOne.admission,
    admissionTwo: assignmentTwo.admission,
    assignmentOne,
    transferOne,
    dischargeOne,
    finalHistory,
    conflict,
  };
}

async function ensureBedFixtures(probeId) {
  const prisma = new PrismaClient();

  try {
    const suffix = probeId.toUpperCase();
    const primary = await prisma.bed.create({
      data: {
        bedNumber: `S01-${suffix}-A`,
        wardName: 'Verifier Ward',
        roomNumber: `${suffix.slice(0, 3)}A`,
        isActive: true,
      },
      select: { id: true, bedNumber: true, wardName: true, roomNumber: true },
    });

    const secondary = await prisma.bed.create({
      data: {
        bedNumber: `S01-${suffix}-B`,
        wardName: 'Verifier Ward',
        roomNumber: `${suffix.slice(0, 3)}B`,
        isActive: true,
      },
      select: { id: true, bedNumber: true, wardName: true, roomNumber: true },
    });

    emit('check', {
      check: 'ipd-bed-fixtures-ready',
      status: 'ok',
      primaryBedId: primary.id,
      primaryBedNumber: primary.bedNumber,
      secondaryBedId: secondary.id,
      secondaryBedNumber: secondary.bedNumber,
    });

    return { primary, secondary };
  } finally {
    await prisma.$disconnect();
  }
}

async function createPatient(accessToken, input) {
  const response = await fetchJson(`${apiBaseUrl}/patients`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(input),
  });

  assertStatus(response.response.status, 201, 'Expected patient creation to succeed.');
  assertSuccessEnvelope(response.payload, '/patients create success path');
  const patient = parsePatient(readEnvelopeData(response.payload, 'patient create'), 'patient create');

  emit('check', {
    check: 'patient-created',
    status: 'ok',
    patientId: patient.id,
    registrationNumber: patient.registrationNumber,
  });

  return patient;
}

async function createAdmission(accessToken, input) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/admissions`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(input),
  });

  assertStatus(response.response.status, 201, 'Expected admission creation to succeed.');
  assertSuccessEnvelope(response.payload, '/ipd/admissions create success path');
  const admission = parseAdmission(readEnvelopeData(response.payload, 'ipd admission create'), 'ipd admission create');

  emit('check', {
    check: 'ipd-admission-created',
    status: 'ok',
    admissionId: admission.id,
    patientId: admission.patientId,
    version: admission.version,
  });

  return admission;
}

async function assignBed(accessToken, input) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/admissions/${input.admissionId}/bed-assignment`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({
      bedId: input.bedId,
      expectedAdmissionVersion: input.expectedAdmissionVersion,
      note: input.note,
    }),
  });

  assertStatus(response.response.status, 200, 'Expected bed assignment to succeed.');
  assertSuccessEnvelope(response.payload, 'ipd bed assignment success path');
  const result = parseLifecycleMutation(readEnvelopeData(response.payload, 'ipd bed assignment'), 'ipd bed assignment');
  assertEqual(result.movement.movementType, 'ASSIGNED', 'Bed assignment should emit an ASSIGNED movement.');

  emit('check', {
    check: 'ipd-bed-assigned',
    status: 'ok',
    admissionId: result.admission.id,
    bedId: result.admission.currentBedOccupancy?.bed.id ?? null,
    bedNumber: result.admission.currentBedOccupancy?.bed.bedNumber ?? null,
    admissionVersion: result.admission.version,
    occupancyVersion: result.admission.currentBedOccupancy?.version ?? null,
  });

  return result;
}

async function transferBed(accessToken, input) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/admissions/${input.admissionId}/bed-transfer`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({
      targetBedId: input.targetBedId,
      expectedAdmissionVersion: input.expectedAdmissionVersion,
      expectedOccupancyVersion: input.expectedOccupancyVersion,
      note: input.note,
    }),
  });

  assertStatus(response.response.status, 200, 'Expected bed transfer to succeed.');
  assertSuccessEnvelope(response.payload, 'ipd bed transfer success path');
  const result = parseLifecycleMutation(readEnvelopeData(response.payload, 'ipd bed transfer'), 'ipd bed transfer');
  assertEqual(result.movement.movementType, 'TRANSFERRED', 'Bed transfer should emit a TRANSFERRED movement.');

  emit('check', {
    check: 'ipd-bed-transferred',
    status: 'ok',
    admissionId: result.admission.id,
    bedId: result.admission.currentBedOccupancy?.bed.id ?? null,
    bedNumber: result.admission.currentBedOccupancy?.bed.bedNumber ?? null,
    admissionVersion: result.admission.version,
    occupancyVersion: result.admission.currentBedOccupancy?.version ?? null,
  });

  return result;
}

async function dischargeAdmission(accessToken, input) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/admissions/${input.admissionId}/discharge`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({
      expectedAdmissionVersion: input.expectedAdmissionVersion,
      expectedOccupancyVersion: input.expectedOccupancyVersion,
      dischargeNotes: input.dischargeNotes,
      movementNote: input.movementNote,
    }),
  });

  assertStatus(response.response.status, 200, 'Expected discharge to succeed.');
  assertSuccessEnvelope(response.payload, 'ipd discharge success path');
  const result = parseLifecycleMutation(readEnvelopeData(response.payload, 'ipd discharge'), 'ipd discharge');
  assertEqual(result.movement.movementType, 'DISCHARGED', 'Discharge should emit a DISCHARGED movement.');
  if (result.admission.currentBedOccupancy !== null) {
    throw new Error('Discharged admission should not retain a current bed occupancy.');
  }

  emit('check', {
    check: 'ipd-admission-discharged',
    status: 'ok',
    admissionId: result.admission.id,
    admissionVersion: result.admission.version,
    dischargeMovementId: result.movement.id,
  });

  return result;
}

async function listOccupancy(accessToken) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/occupancy`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(response.response.status, 200, 'Expected occupancy lookup to succeed.');
  assertSuccessEnvelope(response.payload, '/ipd/occupancy success path');
  const data = readEnvelopeData(response.payload, 'ipd occupancy');
  if (!Array.isArray(data)) {
    throw new Error('IPD occupancy data must be an array.');
  }

  return data.map((entry, index) => parseOccupancyEntry(entry, `ipd occupancy ${index}`));
}

async function listMovements(accessToken, admissionId) {
  const response = await fetchJson(`${apiBaseUrl}/ipd/admissions/${admissionId}/movements`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(response.response.status, 200, 'Expected movement history lookup to succeed.');
  assertSuccessEnvelope(response.payload, '/ipd/admissions/{id}/movements success path');
  const data = readEnvelopeData(response.payload, 'ipd movement history');
  if (!Array.isArray(data)) {
    throw new Error('IPD movement history data must be an array.');
  }

  return data.map((entry, index) => parseMovement(entry, `ipd movement history ${index}`));
}

function emitBrowserChecklist(verification) {
  const checklist = {
    slice: 'S01',
    verifier: 'verify:s01:live',
    sessionStorageKey: SESSION_STORAGE_KEY,
    liveProbe: {
      receptionistUserId: verification.receptionist.userId,
      receptionistUsername: verification.receptionist.username,
      doctorUserId: verification.doctor.userId,
      doctorUsername: verification.doctor.username,
      firstPatientRegistrationNumber: verification.patientOne.registrationNumber,
      secondPatientRegistrationNumber: verification.patientTwo.registrationNumber,
      firstAdmissionId: verification.admissionOne.id,
      firstAdmissionVersion: verification.admissionOne.version,
      secondAdmissionId: verification.admissionTwo.id,
      secondAdmissionVersion: verification.admissionTwo.version,
      primaryBedId: verification.beds.primary.id,
      primaryBedNumber: verification.beds.primary.bedNumber,
      secondaryBedId: verification.beds.secondary.id,
      secondaryBedNumber: verification.beds.secondary.bedNumber,
      conflictCode: 'BED_OCCUPANCY_CONFLICT',
      movementTypes: verification.finalHistory.map((entry) => entry.movementType),
    },
    authenticatedSeed: {
      route: '/app/reception/inpatients',
      sessionStorage: {
        accessToken: verification.receptionist.accessToken,
        role: verification.receptionist.role,
        userId: verification.receptionist.userId,
        username: verification.receptionist.username,
      },
      cookieInstruction: 'Use the live refresh cookie returned by /auth/login when replaying browser assertions in the same session.',
    },
    degradedProbe: {
      route: '/app/reception/inpatients',
      instruction:
        'To observe the fail-closed unavailable marker live, make the backend unreachable or stop the Node API, then reload /app/reception/inpatients with the authenticated receptionist session still seeded.',
      selectors: [
        '[data-testid="reception-inpatients-unavailable-state"][data-screen-code="UNAVAILABLE"][data-screen-status="unavailable"]',
      ],
    },
    assertions: [
      {
        id: 'ipd-ready-shell',
        role: verification.receptionist.role,
        path: '/app/reception/inpatients',
        selectors: [
          '[data-testid="app-shell"][data-role="receptionist"][data-auth-status="authenticated"]',
          '[data-testid="reception-inpatients-page"]',
          '[data-testid="reception-inpatients-ready-state"][data-screen-status="ready"]',
          '[data-testid="reception-inpatients-conflict-note"]',
        ],
      },
      {
        id: 'ipd-occupancy-and-history-truth',
        role: verification.receptionist.role,
        path: '/app/reception/inpatients',
        selectors: [
          '[data-testid="app-shell"][data-role="receptionist"][data-auth-status="authenticated"]',
          '[data-testid="reception-inpatients-page"]',
          '[data-testid="reception-inpatients-success-state"][data-screen-code="DISCHARGED"][data-screen-status="success"]',
          '[data-testid="reception-inpatients-occupancy-list"]',
          `[data-testid="reception-inpatients-occupancy-row-${verificationState.evidence.remainingOccupancyId}"]`,
          '[data-testid="reception-inpatients-history-list"]',
          `[data-testid="reception-inpatients-history-row-${verification.finalHistory[0].id}"]`,
          `[data-testid="reception-inpatients-history-row-${verification.finalHistory[1].id}"]`,
          `[data-testid="reception-inpatients-history-row-${verification.finalHistory[2].id}"]`,
        ],
        expectedValues: {
          dischargedAdmissionId: verification.admissionOne.id,
          remainingAdmissionId: verification.admissionTwo.id,
          remainingBedNumber: verification.beds.primary.bedNumber,
          transferBedNumber: verification.beds.secondary.bedNumber,
          firstPatientRegistrationNumber: verification.patientOne.registrationNumber,
          secondPatientRegistrationNumber: verification.patientTwo.registrationNumber,
        },
      },
      {
        id: 'ipd-conflict-state',
        role: verification.receptionist.role,
        path: '/app/reception/inpatients',
        selectors: [
          '[data-testid="reception-inpatients-conflict-state"][data-screen-code="BED_OCCUPANCY_CONFLICT"][data-screen-status="conflict"]',
          '[data-testid="reception-inpatients-conflict-note"]',
        ],
        expectedValues: {
          admissionId: verification.admissionTwo.id,
          targetBedId: verification.beds.secondary.id,
          targetBedNumber: verification.beds.secondary.bedNumber,
          errorCode: 'BED_OCCUPANCY_CONFLICT',
        },
      },
      {
        id: 'ipd-unavailable-state',
        role: verification.receptionist.role,
        path: '/app/reception/inpatients',
        selectors: [
          '[data-testid="reception-inpatients-unavailable-state"][data-screen-code="UNAVAILABLE"][data-screen-status="unavailable"]',
        ],
      },
    ],
  };

  emit('browser-checklist', checklist);
}

async function loginUser(username, password) {
  const response = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username, password }),
  });

  assertStatus(response.response.status, 200, `Expected ${username} login to succeed.`);
  assertSuccessEnvelope(response.payload, `/auth/login success path for ${username}`);
  const payload = expectRecord(readEnvelopeData(response.payload, `${username} login`), `${username} auth payload`);
  const user = expectRecord(payload.user, `${username} auth user`);
  const refreshCookie = getFirstSetCookie(response.response);

  const session = {
    accessToken: expectString(payload.accessToken, `${username} access token`),
    refreshCookie,
    userId: expectString(user.id, `${username} user.id`),
    username: expectString(user.username, `${username} user.username`),
    role: expectString(user.role, `${username} user.role`).trim().toLowerCase(),
  };

  const me = await fetchJson(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: bearerHeaders(session.accessToken),
  });

  assertStatus(me.response.status, 200, `Expected /auth/me to succeed for ${username}.`);
  assertSuccessEnvelope(me.payload, `/auth/me success path for ${username}`);
  const meData = expectRecord(readEnvelopeData(me.payload, `${username} auth me`), `${username} auth me data`);
  assertEqual(expectString(meData.id, `${username} auth me id`), session.userId, `Unexpected /auth/me id for ${username}.`);
  assertEqual(
    expectString(meData.username, `${username} auth me username`),
    session.username,
    `Unexpected /auth/me username for ${username}.`,
  );

  emit('check', {
    check: 'auth-bootstrap',
    status: 'ok',
    username: session.username,
    role: session.role,
  });

  return session;
}

async function waitForJsonEndpoint({ description, expect, path }) {
  await poll(
    async () => {
      const { response, payload } = await fetchJson(`${apiBaseUrl}${path}`, { method: 'GET' });
      assertStatus(response.status, 200, `${description} returned ${response.status} instead of 200.`);
      expect(payload, description);
      return payload;
    },
    `${description} at ${apiBaseUrl}${path}`,
  );
}

async function waitForHtmlPage({ description, path }) {
  await poll(
    async () => {
      const response = await fetchWithTimeout(`${frontendUrl}${path}`, { redirect: 'follow' });
      assertStatus(response.status, 200, `${description} returned ${response.status} instead of 200.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`${description} returned unexpected content-type: ${contentType || 'missing'}.`);
      }

      const html = await response.text();
      if (!html.includes('<div id="root"></div>')) {
        throw new Error(`${description} did not render the expected Vite root shell.`);
      }

      return html;
    },
    `${description} at ${frontendUrl}${path}`,
  );
}

async function poll(operation, description) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}. Last error: ${reason}`);
}

async function fetchJson(url, init) {
  const response = await fetchWithTimeout(url, init);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url} but received content-type ${contentType || 'missing'}.`);
  }

  const bodyText = await response.text();

  try {
    const payload = JSON.parse(bodyText);
    return { response, payload };
  } catch {
    const snippet = bodyText.slice(0, 240).replace(/\s+/g, ' ').trim();
    throw new Error(`Expected JSON from ${url} but received malformed body: ${snippet || '<empty body>'}`);
  }
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function phase(name, operation) {
  verificationState.currentPhase = name;
  const result = await operation();
  verificationState.lastSuccessfulPhase = name;
  return result;
}

function parsePatient(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    registrationNumber: expectString(record.registrationNumber, `${context}.registrationNumber`),
    fullName: expectString(record.fullName, `${context}.fullName`),
    primaryPhone: expectString(record.primaryPhone, `${context}.primaryPhone`),
  };
}

function parseLifecycleMutation(value, context) {
  const record = expectRecord(value, context);
  return {
    admission: parseAdmission(record.admission, `${context}.admission`),
    movement: parseMovement(record.movement, `${context}.movement`),
  };
}

function parseAdmission(value, context) {
  const record = expectRecord(value, context);
  const patientRecord = record.patient && typeof record.patient === 'object' ? expectRecord(record.patient, `${context}.patient`) : null;

  return {
    id: expectString(record.id, `${context}.id`),
    patientId: expectString(record.patientId, `${context}.patientId`),
    attendingDoctorUserId: optionalString(record.attendingDoctorUserId, `${context}.attendingDoctorUserId`),
    status: expectString(record.status, `${context}.status`),
    notes: optionalString(record.notes, `${context}.notes`),
    dischargeNotes: optionalString(record.dischargeNotes, `${context}.dischargeNotes`),
    version: expectPositiveInteger(record.version, `${context}.version`),
    currentBedOccupancy:
      record.currentBedOccupancy === null || record.currentBedOccupancy === undefined
        ? null
        : parseCurrentBedOccupancy(record.currentBedOccupancy, `${context}.currentBedOccupancy`),
    patient:
      patientRecord === null
        ? null
        : {
            id: expectString(patientRecord.id, `${context}.patient.id`),
            registrationNumber: expectString(patientRecord.registrationNumber, `${context}.patient.registrationNumber`),
            fullName: expectString(patientRecord.fullName, `${context}.patient.fullName`),
          },
  };
}

function parseCurrentBedOccupancy(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    bedId: expectString(record.bedId, `${context}.bedId`),
    version: expectPositiveInteger(record.version, `${context}.version`),
    bed: parseBed(record.bed, `${context}.bed`),
  };
}

function parseOccupancyEntry(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    bedId: expectString(record.bedId, `${context}.bedId`),
    version: expectPositiveInteger(record.version, `${context}.version`),
    assignedByUserId: expectString(record.assignedByUserId, `${context}.assignedByUserId`),
    bed: parseBed(record.bed, `${context}.bed`),
    admission: parseAdmission(record.admission, `${context}.admission`),
  };
}

function parseMovement(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    admissionId: expectString(record.admissionId, `${context}.admissionId`),
    movementType: expectString(record.movementType, `${context}.movementType`),
    fromBed: record.fromBed === null ? null : parseBed(record.fromBed, `${context}.fromBed`),
    toBed: record.toBed === null ? null : parseBed(record.toBed, `${context}.toBed`),
    note: record.note === null ? null : expectString(record.note, `${context}.note`),
    movedByUser: parseOperator(record.movedByUser, `${context}.movedByUser`),
  };
}

function parseBed(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    bedNumber: expectString(record.bedNumber, `${context}.bedNumber`),
    wardName: expectString(record.wardName, `${context}.wardName`),
    roomNumber: record.roomNumber === null ? null : expectString(record.roomNumber, `${context}.roomNumber`),
  };
}

function parseOperator(value, context) {
  const record = expectRecord(value, context);
  return {
    id: expectString(record.id, `${context}.id`),
    username: expectString(record.username, `${context}.username`),
    role: expectString(record.role, `${context}.role`),
  };
}

function readEnvelopeData(payload, context) {
  const record = expectRecord(payload, `${context} envelope`);
  if (record.success !== true) {
    throw new Error(`${context} envelope must declare success=true.`);
  }
  if (!("data" in record)) {
    throw new Error(`${context} envelope is missing data.`);
  }
  return record.data;
}

function readErrorCode(payload, context) {
  const record = expectRecord(payload, context);
  const error = expectRecord(record.error, `${context}.error`);
  return expectString(error.code, `${context}.error.code`);
}

function expectHealthPayload(payload, description) {
  const record = expectRecord(payload, description);
  if (record.success !== true) {
    throw new Error(`${description} did not return success=true.`);
  }

  const data = expectRecord(record.data, `${description}.data`);
  if (data.status !== 'ok' || data.ready !== true) {
    throw new Error(`${description} returned an unexpected readiness payload.`);
  }
}

function assertSuccessEnvelope(payload, label) {
  const record = expectRecord(payload, label);
  if (record.success !== true || !('data' in record)) {
    throw new Error(`${label} did not return a success envelope.`);
  }
}

function assertErrorCode(payload, expectedCode, label) {
  const record = expectRecord(payload, label);
  const error = expectRecord(record.error, `${label}.error`);
  const actualCode = error.code;
  if (actualCode !== expectedCode) {
    throw new Error(`${label} returned error code ${String(actualCode)} instead of ${expectedCode}.`);
  }
}

function findOccupancyByAdmissionId(entries, admissionId, context) {
  const entry = entries.find((item) => item.admission.id === admissionId);
  if (!entry) {
    throw new Error(`Admission ${admissionId} did not appear in ${context}.`);
  }
  return entry;
}

function expectOccupancyVersion(occupancy, context) {
  if (!occupancy) {
    throw new Error(`${context} requires a current bed occupancy.`);
  }
  return occupancy.version;
}

function getFirstSetCookie(response) {
  const cookieHeader = response.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Expected a Set-Cookie header but none was returned.');
  }

  return cookieHeader.split(',')[0].trim();
}

function bearerHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function jsonHeaders(accessToken) {
  return {
    ...(accessToken ? bearerHeaders(accessToken) : {}),
    'Content-Type': 'application/json',
  };
}

function sanitizedEvidence() {
  const snapshot = {
    receptionistUserId: verificationState.evidence.receptionistUserId,
    receptionistUsername: verificationState.evidence.receptionistUsername,
    doctorUserId: verificationState.evidence.doctorUserId,
    doctorUsername: verificationState.evidence.doctorUsername,
    firstPatientId: verificationState.evidence.firstPatientId,
    firstPatientRegistrationNumber: verificationState.evidence.firstPatientRegistrationNumber,
    secondPatientId: verificationState.evidence.secondPatientId,
    secondPatientRegistrationNumber: verificationState.evidence.secondPatientRegistrationNumber,
    firstAdmissionId: verificationState.evidence.firstAdmissionId,
    firstAdmissionVersion: verificationState.evidence.firstAdmissionVersion,
    secondAdmissionId: verificationState.evidence.secondAdmissionId,
    secondAdmissionVersion: verificationState.evidence.secondAdmissionVersion,
    primaryBedId: verificationState.evidence.primaryBedId,
    primaryBedNumber: verificationState.evidence.primaryBedNumber,
    secondaryBedId: verificationState.evidence.secondaryBedId,
    secondaryBedNumber: verificationState.evidence.secondaryBedNumber,
    firstAssignmentOccupancyId: verificationState.evidence.firstAssignmentOccupancyId,
    transferredOccupancyId: verificationState.evidence.transferredOccupancyId,
    remainingOccupancyId: verificationState.evidence.remainingOccupancyId,
    assignedMovementId: verificationState.evidence.assignedMovementId,
    dischargeMovementId: verificationState.evidence.dischargeMovementId,
    conflictCode: verificationState.evidence.conflictCode,
  };

  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== undefined));
}

function emit(event, payload) {
  const body = {
    event,
    at: new Date().toISOString(),
    phase: verificationState.currentPhase,
    ...payload,
  };

  process.stdout.write(`${JSON.stringify(body)}\n`);
}

function expectRecord(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
}

function expectString(value, context) {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string.`);
  }
  return value;
}

function optionalString(value, context) {
  if (value === null || value === undefined) {
    return null;
  }
  return expectString(value, context);
}

function expectPositiveInteger(value, context) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive integer.`);
  }
  return value;
}

function assertStatus(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Received ${actual}.`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Received ${JSON.stringify(actual)} instead of ${JSON.stringify(expected)}.`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message} Received ${actualJson} instead of ${expectedJson}.`);
  }
}

function assertTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`S01_VERIFY_TIMEOUT_MS must be a positive number. Received ${String(value)}.`);
  }
}

function normalizeUrl(value) {
  return value.replace(/\/$/, '');
}

function uniquePhone(prefix) {
  return `+1555${prefix}${Date.now().toString().slice(-5)}`;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  emit('result', {
    verifier: 'S01',
    status: 'error',
    lastSuccessfulPhase: verificationState.lastSuccessfulPhase,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
