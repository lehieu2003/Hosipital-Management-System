#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;
const SESSION_STORAGE_KEY = 'hms.frontend.session';

const frontendUrl = normalizeUrl(process.env.S15_FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL);
const apiBaseUrl = normalizeUrl(process.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL);
const timeoutMs = Number(process.env.S15_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

async function main() {
  assertTimeout(timeoutMs);

  logSection('S15 live localhost verifier');
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(`API base URL: ${apiBaseUrl}`);
  console.log(
    process.env.VITE_API_BASE_URL?.trim()
      ? 'Frontend API base comes from VITE_API_BASE_URL.'
      : `VITE_API_BASE_URL is unset; the frontend will fall back to ${DEFAULT_API_BASE_URL}.`,
  );
  console.log('This verifier never prints access tokens, refresh cookies, or extra patient detail beyond contractual fields.');

  await waitForJsonEndpoint({
    description: 'backend health endpoint',
    expect: expectHealthPayload,
    path: '/healthz',
  });

  await waitForHtmlPage({
    description: 'frontend landing page',
    path: '/',
  });

  await waitForHtmlPage({
    description: 'frontend login page',
    path: '/login',
  });

  const liveProbe = await verifySchedulingAndQueueContract();
  printBrowserChecklist(liveProbe);
}

async function verifySchedulingAndQueueContract() {
  logSection('Auth + operational contract preflight');

  const invalidLogin = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username: 'doctor', password: 'wrong-password' }),
  });

  assertStatus(invalidLogin.response.status, 401, 'Expected invalid login to fail with 401.');
  assertErrorCode(invalidLogin.payload, 'INVALID_CREDENTIALS', '/auth/login invalid-credential path');
  console.log('✓ /auth/login rejects invalid credentials with INVALID_CREDENTIALS.');

  const receptionist = await loginUser('reception', 'secret123');
  const doctorDirectory = await fetchJson(`${apiBaseUrl}/doctors`, {
    method: 'GET',
    headers: bearerHeaders(receptionist.accessToken),
  });

  assertStatus(doctorDirectory.response.status, 200, 'Expected /doctors to succeed for reception.');
  assertSuccessEnvelope(doctorDirectory.payload, '/doctors success path');
  const doctors = parseDoctorDirectory(doctorDirectory.payload);
  if (doctors.length === 0) {
    throw new Error('/doctors returned an empty doctor directory; S15 expects at least one schedulable doctor.');
  }
  console.log(`✓ /doctors returned ${doctors.length} schedulable doctor principal(s).`);

  const probeId = randomUUID().slice(0, 8);
  const patientPayload = {
    fullName: `S15 Live Probe ${probeId}`,
    primaryPhone: `+1555${Date.now().toString().slice(-7)}`,
    email: `s15-live-${probeId}@example.test`,
    dateOfBirth: '1990-04-12',
    gender: 'UNSPECIFIED',
    address: 'S15 verifier synthetic patient',
  };

  const patient = await fetchJson(`${apiBaseUrl}/patients`, {
    method: 'POST',
    headers: jsonHeaders(receptionist.accessToken),
    body: JSON.stringify(patientPayload),
  });

  assertStatus(patient.response.status, 201, 'Expected /patients to create a live probe patient.');
  assertSuccessEnvelope(patient.payload, '/patients success path');
  const registeredPatient = parseRegisteredPatient(patient.payload);
  console.log('✓ /patients registers a probe patient for the receptionist workflow.');

  const appointmentPayload = {
    patientId: registeredPatient.id,
    doctorUserId: doctors[0].id,
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    durationMinutes: 30,
    notes: `S15 live verifier ${probeId}`,
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
  console.log('✓ /appointments creates a SCHEDULED appointment against the live doctor directory.');

  const doctor = await loginUser('doctor', 'secret123');
  const queue = await fetchJson(`${apiBaseUrl}/doctor/queue`, {
    method: 'GET',
    headers: bearerHeaders(doctor.accessToken),
  });

  assertStatus(queue.response.status, 200, 'Expected /doctor/queue to succeed for doctor.');
  assertSuccessEnvelope(queue.payload, '/doctor/queue success path');
  const queueEntries = parseDoctorQueue(queue.payload);
  const probeQueueEntry = queueEntries.find((entry) => entry.id === scheduledAppointment.id);
  if (!probeQueueEntry) {
    throw new Error('The newly scheduled appointment did not appear in /doctor/queue.');
  }
  assertEqual(probeQueueEntry.status, 'SCHEDULED', 'Queued probe appointment did not remain SCHEDULED.');
  assertEqual(probeQueueEntry.patient.registrationNumber, registeredPatient.registrationNumber, 'Queued probe appointment did not preserve the patient registration number.');
  console.log('✓ /doctor/queue exposes the newly scheduled appointment to the authenticated doctor.');

  return {
    appointmentId: scheduledAppointment.id,
    patientRegistrationNumber: registeredPatient.registrationNumber,
    receptionistUsername: receptionist.username,
    doctorUsername: doctor.username,
  };
}

function printBrowserChecklist(liveProbe) {
  logSection('Browser contract checklist');

  const assertions = [
    {
      step: 1,
      role: 'admin',
      path: '/app/admin',
      assertions: [
        '[data-testid="app-shell"][data-role="admin"][data-auth-status="authenticated"]',
        '[data-testid="admin-overview-unavailable-state"][data-screen-code="CONTRACT_PENDING"][data-screen-status="unavailable"]',
      ],
      proves: 'Admin remains fail-closed and explicitly pending in S15.',
    },
    {
      step: 2,
      role: 'receptionist',
      path: '/app/reception/scheduling',
      assertions: [
        '[data-testid="app-shell"][data-role="receptionist"][data-auth-status="authenticated"]',
        '[data-testid="reception-scheduling-page"]',
        '[data-testid="reception-scheduling-ready-state"][data-screen-code="READY"][data-screen-status="idle"]',
        '[data-testid="appointment-doctor-select"]',
      ],
      proves: 'Reception home is a live scheduling screen rather than a CONTRACT_PENDING placeholder.',
    },
    {
      step: 3,
      role: 'doctor',
      path: '/app/doctor/queue',
      assertions: [
        '[data-testid="app-shell"][data-role="doctor"][data-auth-status="authenticated"]',
        '[data-testid="doctor-queue-page"]',
        '[data-testid="doctor-queue-action-ready-state"][data-screen-code="READY"]',
        `[data-testid="doctor-queue-item-${liveProbe.appointmentId}"][data-appointment-status="SCHEDULED"]`,
        `[data-testid="doctor-queue-version-${liveProbe.appointmentId}"]`,
      ],
      proves: 'Doctor home is a live queue screen backed by the appointment created during this verifier run.',
    },
    {
      step: 4,
      role: 'refresh-failure',
      path: '/app/doctor/queue',
      assertions: [
        '[data-testid="refresh-required-banner"]',
        '[data-testid="login-page"][data-auth-status="refresh-failed"][data-session-notice="refresh-failed"]',
      ],
      proves: 'Refresh recovery still fails closed back to login even when the doctor route would normally fetch live queue data.',
    },
  ];

  console.log(JSON.stringify({
    slice: 'S15',
    sessionStorageKey: SESSION_STORAGE_KEY,
    liveProbe,
    assertions,
    scope: {
      proves: [
        'Node-backed receptionist scheduling seam is live enough to register a patient and create an appointment.',
        'Node-backed doctor queue seam is live enough to surface that appointment to the authenticated doctor.',
        'Stable shell and screen data attributes remain available for browser-level verification.',
      ],
      stillOwnedByS16: [
        'Broader milestone-wide live regression/UAT beyond these focused role and contract checks.',
        'Any future expansion that turns the admin screen from CONTRACT_PENDING into a live operational workflow.',
      ],
    },
  }, null, 2));
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
  const payload = login.payload.data;
  const accessToken = expectString(payload?.accessToken, `${username} access token`);
  const user = expectRecord(payload?.user, `${username} auth user`);
  const resolvedUsername = expectString(user.username, `${username} auth user.username`);

  const me = await fetchJson(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(me.response.status, 200, `Expected /auth/me to succeed for ${username}.`);
  assertSuccessEnvelope(me.payload, `/auth/me success path for ${username}`);
  assertEqual(expectString(me.payload.data.username, `${username} /auth/me username`), resolvedUsername, `/auth/me returned the wrong username for ${username}.`);
  console.log(`✓ ${username} auth bootstrap succeeds against /auth/login and /auth/me.`);

  return {
    accessToken,
    refreshCookie,
    username: resolvedUsername,
  };
}

async function waitForJsonEndpoint({ description, expect, path }) {
  logSection(`Polling ${description}`);
  await poll(
    async () => {
      const { response, payload } = await fetchJson(`${apiBaseUrl}${path}`, { method: 'GET' });
      assertStatus(response.status, 200, `${description} returned ${response.status} instead of 200.`);
      expect(payload, description);
      return payload;
    },
    `${description} at ${apiBaseUrl}${path}`,
  );
  console.log(`✓ ${description} is reachable.`);
}

async function waitForHtmlPage({ description, path }) {
  logSection(`Polling ${description}`);
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
  console.log(`✓ ${description} is reachable.`);
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
    status: expectString(data.status, 'appointment.status'),
  };
}

function parseDoctorQueue(payload) {
  const data = readEnvelopeData(payload, 'doctor queue');
  if (!Array.isArray(data)) {
    throw new Error('Doctor queue data must be an array.');
  }

  return data.map((entry, index) => {
    const record = expectRecord(entry, `doctor queue item ${index}`);
    const patient = expectRecord(record.patient, `doctor queue item ${index}.patient`);

    return {
      id: expectString(record.id, `doctor queue item ${index}.id`),
      status: expectString(record.status, `doctor queue item ${index}.status`),
      version: expectNumber(record.version, `doctor queue item ${index}.version`),
      patient: {
        registrationNumber: expectString(patient.registrationNumber, `doctor queue item ${index}.patient.registrationNumber`),
      },
    };
  });
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
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${description} returned a non-object JSON payload.`);
  }

  if (payload.success !== true) {
    throw new Error(`${description} did not return success=true.`);
  }

  if (payload.data?.status !== 'ok' || payload.data?.ready !== true) {
    throw new Error(`${description} returned an unexpected readiness payload.`);
  }
}

function assertSuccessEnvelope(payload, label) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${label} returned a non-object JSON payload.`);
  }

  if (payload.success !== true || !payload.data) {
    throw new Error(`${label} did not return a success envelope.`);
  }
}

function assertErrorCode(payload, expectedCode, label) {
  const actualCode = payload?.error?.code;
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

function expectNumber(value, context) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${context} must be a number.`);
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
    throw new Error(`S15_VERIFY_TIMEOUT_MS must be a positive number, received ${String(value)}.`);
  }
}

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`\nS15 live verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
