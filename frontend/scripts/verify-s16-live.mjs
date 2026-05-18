#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const SESSION_STORAGE_KEY = 'hms.frontend.session';

const frontendUrl = normalizeUrl(process.env.S16_FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL);
const apiBaseUrl = normalizeUrl(
  process.env.S16_API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);
const timeoutMs = Number(process.env.S16_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

async function main() {
  assertTimeout(timeoutMs);

  emit('config', {
    verifier: 'S16',
    frontendUrl,
    apiBaseUrl,
    timeoutMs,
    redaction: {
      hides: ['accessToken', 'refreshCookie', 'patientFullName', 'patientPhone', 'patientEmail'],
    },
  });

  await waitForJsonEndpoint({
    description: 'backend-health',
    expect: expectHealthPayload,
    path: '/healthz',
  });

  await waitForHtmlPage({
    description: 'frontend-landing',
    path: '/',
  });

  await waitForHtmlPage({
    description: 'frontend-login',
    path: '/login',
  });

  const verification = await verifyLiveRoleJourney();
  emitBrowserChecklist(verification);
  emit('result', {
    verifier: 'S16',
    status: 'ok',
    proves: [
      'Admin auth bootstrap is live while admin UI remains explicitly pending.',
      'Reception can create a live patient and appointment against the Node backend.',
      'Doctor can observe that appointment in the live queue and advance it from SCHEDULED to CHECKED_IN to COMPLETED.',
      'Stable browser selectors remain available for admin pending, receptionist scheduling, doctor queue, RBAC denial, and refresh fail-closed checks.',
    ],
  });
}

async function verifyLiveRoleJourney() {
  const invalidLogin = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username: 'doctor', password: 'wrong-password' }),
  });

  assertStatus(invalidLogin.response.status, 401, 'Expected invalid login to fail with 401.');
  assertErrorCode(invalidLogin.payload, 'INVALID_CREDENTIALS', '/auth/login invalid-credential path');
  emit('check', {
    check: 'invalid-login-rejected',
    status: 'ok',
    errorCode: 'INVALID_CREDENTIALS',
  });

  const admin = await loginUser('admin', 'secret123');
  assertEqual(admin.role, 'admin', 'Admin login returned the wrong role.');
  emit('check', {
    check: 'admin-auth-bootstrap',
    status: 'ok',
    username: admin.username,
    role: admin.role,
    pendingUiState: {
      route: '/app/admin',
      testId: 'admin-overview-unavailable-state',
      code: 'CONTRACT_PENDING',
    },
  });

  const receptionist = await loginUser('reception', 'secret123');
  const doctorDirectory = await fetchJson(`${apiBaseUrl}/doctors`, {
    method: 'GET',
    headers: bearerHeaders(receptionist.accessToken),
  });

  assertStatus(doctorDirectory.response.status, 200, 'Expected /doctors to succeed for reception.');
  assertSuccessEnvelope(doctorDirectory.payload, '/doctors success path');
  const doctors = parseDoctorDirectory(doctorDirectory.payload);
  if (doctors.length === 0) {
    throw new Error('/doctors returned an empty doctor directory; S16 expects at least one schedulable doctor.');
  }

  const doctorChoice = doctors.find((entry) => entry.username === 'doctor') ?? doctors[0];
  emit('check', {
    check: 'doctor-directory-ready',
    status: 'ok',
    doctorCount: doctors.length,
    selectedDoctorUsername: doctorChoice.username,
  });

  const probeId = randomUUID().slice(0, 8);
  const patientPayload = {
    fullName: `S16 Live Probe ${probeId}`,
    primaryPhone: `+1555${Date.now().toString().slice(-7)}`,
    email: `s16-live-${probeId}@example.test`,
    dateOfBirth: '1990-04-12',
    gender: 'UNSPECIFIED',
    address: 'S16 verifier synthetic patient',
  };

  const patient = await fetchJson(`${apiBaseUrl}/patients`, {
    method: 'POST',
    headers: jsonHeaders(receptionist.accessToken),
    body: JSON.stringify(patientPayload),
  });

  assertStatus(patient.response.status, 201, 'Expected /patients to create a live probe patient.');
  assertSuccessEnvelope(patient.payload, '/patients success path');
  const registeredPatient = parseRegisteredPatient(patient.payload);
  emit('check', {
    check: 'patient-created',
    status: 'ok',
    patientId: registeredPatient.id,
    registrationNumber: registeredPatient.registrationNumber,
  });

  const appointmentPayload = {
    patientId: registeredPatient.id,
    doctorUserId: doctorChoice.id,
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    durationMinutes: 30,
    notes: `S16 live verifier ${probeId}`,
  };

  const appointment = await fetchJson(`${apiBaseUrl}/appointments`, {
    method: 'POST',
    headers: jsonHeaders(receptionist.accessToken),
    body: JSON.stringify(appointmentPayload),
  });

  assertStatus(appointment.response.status, 201, 'Expected /appointments to create a live probe appointment.');
  assertSuccessEnvelope(appointment.payload, '/appointments success path');
  const scheduledAppointment = parseScheduledAppointment(appointment.payload);
  assertEqual(scheduledAppointment.status, 'SCHEDULED', 'Probe appointment did not start in SCHEDULED state.');
  emit('check', {
    check: 'appointment-scheduled',
    status: 'ok',
    appointmentId: scheduledAppointment.id,
    appointmentStatus: scheduledAppointment.status,
    appointmentVersion: scheduledAppointment.version,
    doctorUsername: doctorChoice.username,
  });

  const doctor = await loginUser('doctor', 'secret123');
  assertEqual(doctor.role, 'doctor', 'Doctor login returned the wrong role.');
  const initialQueue = await fetchDoctorQueue(doctor.accessToken);
  const scheduledQueueEntry = findQueueEntry(initialQueue, scheduledAppointment.id, 'initial doctor queue lookup');
  assertEqual(scheduledQueueEntry.status, 'SCHEDULED', 'Queued probe appointment did not remain SCHEDULED.');
  assertEqual(
    scheduledQueueEntry.patient.registrationNumber,
    registeredPatient.registrationNumber,
    'Queued probe appointment did not preserve the patient registration number.',
  );
  emit('check', {
    check: 'doctor-queue-saw-scheduled-appointment',
    status: 'ok',
    appointmentId: scheduledQueueEntry.id,
    appointmentVersion: scheduledQueueEntry.version,
    appointmentStatus: scheduledQueueEntry.status,
    registrationNumber: scheduledQueueEntry.patient.registrationNumber,
  });

  const checkedIn = await patchDoctorQueueAppointment({
    accessToken: doctor.accessToken,
    appointmentId: scheduledQueueEntry.id,
    version: scheduledQueueEntry.version,
    status: 'CHECKED_IN',
  });
  assertEqual(checkedIn.status, 'CHECKED_IN', 'Doctor queue check-in did not return CHECKED_IN.');
  assertEqual(checkedIn.version, scheduledQueueEntry.version + 1, 'Doctor queue check-in did not increment the version by one.');

  const queueAfterCheckIn = await fetchDoctorQueue(doctor.accessToken);
  const checkedInQueueEntry = findQueueEntry(queueAfterCheckIn, scheduledAppointment.id, 'post CHECKED_IN queue lookup');
  assertEqual(checkedInQueueEntry.status, 'CHECKED_IN', 'Authoritative queue refresh did not show CHECKED_IN.');
  assertEqual(checkedInQueueEntry.version, checkedIn.version, 'Authoritative queue refresh returned an unexpected CHECKED_IN version.');
  emit('check', {
    check: 'doctor-queue-check-in',
    status: 'ok',
    appointmentId: checkedInQueueEntry.id,
    appointmentVersion: checkedInQueueEntry.version,
    appointmentStatus: checkedInQueueEntry.status,
  });

  const completed = await patchDoctorQueueAppointment({
    accessToken: doctor.accessToken,
    appointmentId: checkedInQueueEntry.id,
    version: checkedInQueueEntry.version,
    status: 'COMPLETED',
  });
  assertEqual(completed.status, 'COMPLETED', 'Doctor queue completion did not return COMPLETED.');
  assertEqual(completed.version, checkedInQueueEntry.version + 1, 'Doctor queue completion did not increment the version by one.');

  const queueAfterCompletion = await fetchDoctorQueue(doctor.accessToken);
  const completedStillActive = queueAfterCompletion.find((entry) => entry.id === scheduledAppointment.id);
  if (completedStillActive) {
    throw new Error('Completed appointment still appeared in the active doctor queue.');
  }
  emit('check', {
    check: 'doctor-queue-complete-and-evict',
    status: 'ok',
    appointmentId: completed.id,
    appointmentVersion: completed.version,
    appointmentStatus: completed.status,
    remainingActiveQueueCount: queueAfterCompletion.length,
  });

  return {
    appointmentId: scheduledAppointment.id,
    patientRegistrationNumber: registeredPatient.registrationNumber,
    scheduledVersion: scheduledAppointment.version,
    checkedInVersion: checkedIn.version,
    completedVersion: completed.version,
    receptionist: {
      username: receptionist.username,
      role: receptionist.role,
    },
    doctor: {
      username: doctor.username,
      role: doctor.role,
      userId: doctor.userId,
    },
    admin: {
      username: admin.username,
      role: admin.role,
    },
  };
}

function emitBrowserChecklist(verification) {
  emit('browser-checklist', {
    slice: 'S16',
    verifier: 'verify:s16:live',
    sessionStorageKey: SESSION_STORAGE_KEY,
    liveProbe: {
      appointmentId: verification.appointmentId,
      patientRegistrationNumber: verification.patientRegistrationNumber,
      scheduledVersion: verification.scheduledVersion,
      checkedInVersion: verification.checkedInVersion,
      completedVersion: verification.completedVersion,
    },
    refreshFailureSeed: {
      route: '/app/doctor/queue',
      sessionStorage: {
        accessToken: 'expired-doctor-token',
        role: verification.doctor.role,
        userId: verification.doctor.userId,
        username: verification.doctor.username,
      },
      cookieInstruction: 'Ensure no valid refresh cookie is present before loading the route.',
    },
    assertions: [
      {
        id: 'admin-pending',
        role: verification.admin.role,
        path: '/app/admin',
        selectors: [
          '[data-testid="app-shell"][data-role="admin"][data-auth-status="authenticated"]',
          '[data-testid="admin-overview-unavailable-state"][data-screen-code="CONTRACT_PENDING"][data-screen-status="unavailable"]',
        ],
      },
      {
        id: 'reception-scheduling-success',
        role: verification.receptionist.role,
        path: '/app/reception/scheduling',
        selectors: [
          '[data-testid="app-shell"][data-role="receptionist"][data-auth-status="authenticated"]',
          '[data-testid="reception-scheduling-page"]',
          '[data-testid="reception-scheduling-ready-state"][data-screen-code="READY"][data-screen-status="idle"]',
          '[data-testid="appointment-doctor-select"]',
          `[data-testid="scheduled-patient-registration-number"]`,
          `[data-testid="scheduled-appointment-id"]`,
          `[data-testid="scheduled-appointment-version"]`,
          `[data-testid="scheduled-appointment-doctor"]`,
        ],
        expectedValues: {
          registrationNumber: verification.patientRegistrationNumber,
          appointmentId: verification.appointmentId,
          version: String(verification.scheduledVersion),
        },
      },
      {
        id: 'doctor-queue-lifecycle',
        role: verification.doctor.role,
        path: '/app/doctor/queue',
        selectors: [
          '[data-testid="app-shell"][data-role="doctor"][data-auth-status="authenticated"]',
          '[data-testid="doctor-queue-page"]',
          '[data-testid="doctor-queue-action-ready-state"][data-screen-code="READY"]',
          `[data-testid="doctor-queue-item-${verification.appointmentId}"][data-appointment-status="SCHEDULED"]`,
          `[data-testid="doctor-queue-version-${verification.appointmentId}"]`,
        ],
        expectedValues: {
          appointmentId: verification.appointmentId,
          scheduledVersion: String(verification.scheduledVersion),
        },
      },
      {
        id: 'receptionist-admin-denied',
        role: verification.receptionist.role,
        path: '/app/admin',
        selectors: [
          '[data-testid="app-shell"][data-role="receptionist"][data-auth-status="authenticated"]',
          '[data-testid="route-forbidden-state"]',
        ],
      },
      {
        id: 'refresh-fail-closed',
        role: verification.doctor.role,
        path: '/app/doctor/queue',
        selectors: [
          '[data-testid="refresh-required-banner"]',
          '[data-testid="login-page"][data-auth-status="refresh-failed"][data-session-notice="refresh-failed"]',
        ],
      },
    ],
  });
}

async function loginUser(username, password) {
  const login = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username, password }),
  });

  assertStatus(login.response.status, 200, `Expected ${username} login to succeed.`);
  assertSuccessEnvelope(login.payload, `/auth/login success path for ${username}`);
  const refreshCookie = getFirstSetCookie(login.response);
  const payload = expectRecord(login.payload.data, `${username} auth payload`);
  const accessToken = expectString(payload.accessToken, `${username} access token`);
  const user = expectRecord(payload.user, `${username} auth user`);
  const resolvedUsername = expectString(user.username, `${username} auth user.username`);
  const userId = expectString(user.id, `${username} auth user.id`);
  const role = expectString(user.role, `${username} auth user.role`).trim().toLowerCase();

  const me = await fetchJson(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(me.response.status, 200, `Expected /auth/me to succeed for ${username}.`);
  assertSuccessEnvelope(me.payload, `/auth/me success path for ${username}`);
  assertEqual(expectString(me.payload.data.username, `${username} /auth/me username`), resolvedUsername, `/auth/me returned the wrong username for ${username}.`);
  assertEqual(expectString(me.payload.data.id, `${username} /auth/me id`), userId, `/auth/me returned the wrong user id for ${username}.`);

  emit('check', {
    check: 'auth-bootstrap',
    status: 'ok',
    username: resolvedUsername,
    role,
  });

  return {
    accessToken,
    refreshCookie,
    username: resolvedUsername,
    userId,
    role,
  };
}

async function fetchDoctorQueue(accessToken) {
  const queue = await fetchJson(`${apiBaseUrl}/doctor/queue`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(queue.response.status, 200, 'Expected /doctor/queue to succeed for doctor.');
  assertSuccessEnvelope(queue.payload, '/doctor/queue success path');
  return parseDoctorQueue(queue.payload);
}

async function patchDoctorQueueAppointment({ accessToken, appointmentId, version, status }) {
  const response = await fetchJson(`${apiBaseUrl}/doctor/queue/${appointmentId}`, {
    method: 'PATCH',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ version, status }),
  });

  assertStatus(response.response.status, 200, `Expected doctor queue ${status} transition to succeed.`);
  assertSuccessEnvelope(response.payload, `/doctor/queue/${appointmentId} ${status} success path`);
  return parseDoctorQueueMutation(response.payload);
}

function findQueueEntry(queueEntries, appointmentId, context) {
  const queueEntry = queueEntries.find((entry) => entry.id === appointmentId);
  if (!queueEntry) {
    throw new Error(`Appointment ${appointmentId} did not appear in ${context}.`);
  }
  return queueEntry;
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
  emit('ready', { target: description, status: 'ok' });
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
  emit('ready', { target: description, status: 'ok' });
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

function parseDoctorDirectory(payload) {
  const data = readEnvelopeData(payload, 'doctor directory');
  if (!Array.isArray(data)) {
    throw new Error('Doctor directory data must be an array.');
  }

  return data.map((entry, index) => {
    const record = expectRecord(entry, `doctor directory entry ${index}`);
    const keys = Object.keys(record).sort();
    if (keys.join(',') !== 'id,username') {
      throw new Error(`doctor directory entry ${index} exposed unexpected fields: ${keys.join(',')}`);
    }

    return {
      id: expectString(record.id, `doctor directory entry ${index}.id`),
      username: expectString(record.username, `doctor directory entry ${index}.username`),
    };
  });
}

function parseRegisteredPatient(payload) {
  const data = expectRecord(readEnvelopeData(payload, 'patient create'), 'patient create data');
  return {
    id: expectString(data.id, 'patient.id'),
    registrationNumber: expectString(data.registrationNumber, 'patient.registrationNumber'),
  };
}

function parseScheduledAppointment(payload) {
  const data = expectRecord(readEnvelopeData(payload, 'appointment create'), 'appointment create data');
  return {
    id: expectString(data.id, 'appointment.id'),
    doctorUserId: expectString(data.doctorUserId, 'appointment.doctorUserId'),
    status: expectString(data.status, 'appointment.status'),
    version: expectPositiveInteger(data.version, 'appointment.version'),
  };
}

function parseDoctorQueue(payload) {
  const data = readEnvelopeData(payload, 'doctor queue');
  if (!Array.isArray(data)) {
    throw new Error('Doctor queue data must be an array.');
  }

  return data.map((entry, index) => parseDoctorQueueAppointment(entry, `doctor queue item ${index}`));
}

function parseDoctorQueueMutation(payload) {
  const data = readEnvelopeData(payload, 'doctor queue update');
  return parseDoctorQueueAppointment(data, 'doctor queue update item');
}

function parseDoctorQueueAppointment(value, context) {
  const record = expectRecord(value, context);
  const patient = expectRecord(record.patient, `${context}.patient`);

  return {
    id: expectString(record.id, `${context}.id`),
    doctorUserId: expectString(record.doctorUserId, `${context}.doctorUserId`),
    status: expectString(record.status, `${context}.status`),
    version: expectPositiveInteger(record.version, `${context}.version`),
    patient: {
      registrationNumber: expectString(patient.registrationNumber, `${context}.patient.registrationNumber`),
    },
  };
}

function readEnvelopeData(payload, context) {
  const record = expectRecord(payload, `${context} envelope`);
  if (record.success !== true) {
    throw new Error(`${context} envelope must declare success=true.`);
  }
  if (!('data' in record)) {
    throw new Error(`${context} envelope is missing data.`);
  }
  return record.data;
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

function getFirstSetCookie(response) {
  const cookieHeader = response.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Expected a Set-Cookie header but none was returned.');
  }

  return cookieHeader.split(',')[0].trim();
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

function expectPositiveInteger(value, context) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive integer.`);
  }

  return value;
}

function assertStatus(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Received ${String(actual)}.`);
  }
}

function bearerHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function jsonHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? bearerHeaders(accessToken) : {}),
  };
}

function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

function assertTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`S16_VERIFY_TIMEOUT_MS must be a positive number, received ${String(value)}.`);
  }
}

function emit(event, payload) {
  console.log(JSON.stringify({ event, ...payload }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: 'result', verifier: 'S16', status: 'error', message }));
  process.exit(1);
});
