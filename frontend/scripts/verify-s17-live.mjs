#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const SESSION_STORAGE_KEY = 'hms.frontend.session';

const frontendUrl = normalizeUrl(process.env.S17_FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL);
const apiBaseUrl = normalizeUrl(
  process.env.S17_API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);
const timeoutMs = Number(process.env.S17_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

const verificationState = {
  currentPhase: 'bootstrap',
  lastSuccessfulPhase: null,
  lastSuccessfulEvent: null,
  evidence: {},
};

async function main() {
  assertTimeout(timeoutMs);

  emit('config', {
    verifier: 'S17',
    frontendUrl,
    apiBaseUrl,
    timeoutMs,
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

  const verification = await verifyLiveRoleJourney();
  emitBrowserChecklist(verification);
  emit('result', {
    verifier: 'S17',
    status: 'ok',
    lastSuccessfulPhase: verificationState.lastSuccessfulPhase,
    proof: sanitizedEvidence(),
    proves: [
      'Admin can create a live department, observe the unassigned state, and bind the seeded doctor through the real admin configuration contract.',
      'Receptionist doctor discovery reads that live assignment and schedules a real appointment against it.',
      'Doctor can observe that appointment in the live queue, move it to CHECKED_IN, then COMPLETED, and the completed visit disappears from the active queue.',
      'Negative RBAC remains fail-closed for receptionist API/admin-route access, and verifier output stays redacted and replayable.',
    ],
    historicalNote:
      'S16 remains the historical proof for receptionist→doctor closure while admin UI stayed pending; S17 supersedes it for live admin configuration closure.',
  });
}

async function verifyLiveRoleJourney() {
  const probeId = randomUUID().slice(0, 8);
  const departmentName = `S17 Live ${probeId}`;
  const patientEmail = `s17-live-${probeId}@example.test`;
  const patientPhone = `+1555${Date.now().toString().slice(-7)}`;

  await phase('auth.invalid-login', async () => {
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
  });

  const admin = await phase('auth.admin-login', () => loginUser('admin', 'secret123'));
  const receptionist = await phase('auth.receptionist-login', () => loginUser('reception', 'secret123'));

  await phase('admin.rbac-denial', async () => {
    const denied = await fetchJson(`${apiBaseUrl}/admin/config/departments`, {
      method: 'GET',
      headers: bearerHeaders(receptionist.accessToken),
    });

    assertStatus(denied.response.status, 403, 'Expected receptionist admin config read to fail with 403.');
    assertErrorCode(denied.payload, 'FORBIDDEN', 'receptionist admin-config denial');
    emit('check', {
      check: 'receptionist-admin-api-denied',
      status: 'ok',
      errorCode: 'FORBIDDEN',
      username: receptionist.username,
    });
  });

  const createdDepartment = await phase('admin.create-department', async () => {
    const response = await fetchJson(`${apiBaseUrl}/admin/config/departments`, {
      method: 'POST',
      headers: jsonHeaders(admin.accessToken),
      body: JSON.stringify({ name: departmentName }),
    });

    assertStatus(response.response.status, 201, 'Expected admin department creation to succeed.');
    assertSuccessEnvelope(response.payload, '/admin/config/departments create success path');
    const department = parseAdminDepartment(readEnvelopeData(response.payload, 'admin department create'), 'created department');
    assertEqual(department.name, departmentName, 'Created department returned the wrong name.');
    assertEqual(department.assignmentCount, 0, 'Created department should start without an assignment.');
    if (department.assignedDoctor !== null) {
      throw new Error('Created department unexpectedly returned an assigned doctor.');
    }

    verificationState.evidence.departmentId = department.id;
    verificationState.evidence.departmentName = department.name;

    emit('check', {
      check: 'admin-department-created',
      status: 'ok',
      departmentId: department.id,
      departmentName: department.name,
      assignmentCount: department.assignmentCount,
    });

    return department;
  });

  await phase('admin.verify-unassigned-state', async () => {
    const departments = await listDepartments(admin.accessToken);
    const created = findDepartment(departments, createdDepartment.id, 'admin post-create list');
    assertEqual(created.assignmentCount, 0, 'Created department should remain unassigned before doctor binding.');
    if (created.assignedDoctor !== null) {
      throw new Error('Created department list unexpectedly showed an assigned doctor before binding.');
    }

    emit('check', {
      check: 'admin-department-unassigned-state',
      status: 'ok',
      departmentId: created.id,
      assignmentCount: created.assignmentCount,
    });
  });

  const doctor = await phase('auth.doctor-login', () => loginUser('doctor', 'secret123'));

  await phase('admin.assign-non-doctor-rejected', async () => {
    const response = await fetchJson(
      `${apiBaseUrl}/admin/config/departments/${createdDepartment.id}/doctor-assignment`,
      {
        method: 'PUT',
        headers: jsonHeaders(admin.accessToken),
        body: JSON.stringify({ doctorUserId: receptionist.userId }),
      },
    );

    assertStatus(response.response.status, 422, 'Expected non-doctor assignment target to fail with 422.');
    assertErrorCode(
      response.payload,
      'DOCTOR_ASSIGNMENT_TARGET_NOT_DOCTOR',
      'admin non-doctor assignment denial',
    );
    emit('check', {
      check: 'admin-assign-non-doctor-rejected',
      status: 'ok',
      errorCode: 'DOCTOR_ASSIGNMENT_TARGET_NOT_DOCTOR',
      departmentId: createdDepartment.id,
      rejectedUserId: receptionist.userId,
    });
  });

  const assignedDepartment = await phase('admin.assign-doctor', async () => {
    const response = await fetchJson(
      `${apiBaseUrl}/admin/config/departments/${createdDepartment.id}/doctor-assignment`,
      {
        method: 'PUT',
        headers: jsonHeaders(admin.accessToken),
        body: JSON.stringify({ doctorUserId: doctor.userId }),
      },
    );

    assertStatus(response.response.status, 200, 'Expected admin doctor assignment to succeed.');
    assertSuccessEnvelope(response.payload, 'admin doctor assignment success path');
    const department = parseAdminDepartment(
      readEnvelopeData(response.payload, 'admin doctor assignment'),
      'assigned department',
    );
    assertEqual(department.assignmentCount, 1, 'Assigned department should report one assignment.');
    const assignedDoctor = expectAssignedDoctor(department.assignedDoctor, 'assigned department.assignedDoctor');
    assertEqual(assignedDoctor.id, doctor.userId, 'Assigned doctor id did not match the seeded doctor.');
    assertEqual(assignedDoctor.username, doctor.username, 'Assigned doctor username did not match the seeded doctor.');

    verificationState.evidence.assignedDoctorId = assignedDoctor.id;
    verificationState.evidence.assignedDoctorUsername = assignedDoctor.username;

    emit('check', {
      check: 'admin-doctor-assigned',
      status: 'ok',
      departmentId: department.id,
      departmentName: department.name,
      doctorUserId: assignedDoctor.id,
      doctorUsername: assignedDoctor.username,
      assignmentCount: department.assignmentCount,
    });

    return department;
  });

  await phase('admin.verify-assigned-state', async () => {
    const departments = await listDepartments(admin.accessToken);
    const assigned = findDepartment(departments, assignedDepartment.id, 'admin post-assignment list');
    assertEqual(assigned.assignmentCount, 1, 'Assigned department should remain assigned after refresh.');
    const assignedDoctor = expectAssignedDoctor(assigned.assignedDoctor, 'listed assigned department.assignedDoctor');
    assertEqual(assignedDoctor.id, doctor.userId, 'Listed assigned doctor id did not match the seeded doctor.');
    assertEqual(assignedDoctor.username, doctor.username, 'Listed assigned doctor username did not match the seeded doctor.');

    emit('check', {
      check: 'admin-assigned-state-refreshed',
      status: 'ok',
      departmentId: assigned.id,
      doctorUserId: assignedDoctor.id,
      doctorUsername: assignedDoctor.username,
      assignmentCount: assigned.assignmentCount,
    });
  });

  const selectedDoctor = await phase('reception.read-doctor-directory', async () => {
    const response = await fetchJson(`${apiBaseUrl}/doctors`, {
      method: 'GET',
      headers: bearerHeaders(receptionist.accessToken),
    });

    assertStatus(response.response.status, 200, 'Expected /doctors to succeed for reception.');
    assertSuccessEnvelope(response.payload, '/doctors success path');
    const doctors = parseDoctorDirectory(response.payload);
    const selected = doctors.find(
      (entry) => entry.id === doctor.userId && entry.departmentId === assignedDepartment.id,
    );

    if (!selected) {
      throw new Error(
        `Expected /doctors to expose the assigned department ${assignedDepartment.id} for doctor ${doctor.userId}.`,
      );
    }

    assertEqual(selected.departmentName, assignedDepartment.name, 'Doctor directory returned the wrong department name.');
    emit('check', {
      check: 'reception-doctor-directory-ready',
      status: 'ok',
      doctorCount: doctors.length,
      selectedDoctorUserId: selected.id,
      selectedDoctorUsername: selected.username,
      selectedDepartmentId: selected.departmentId,
      selectedDepartmentName: selected.departmentName,
    });

    return selected;
  });

  const patientPayload = {
    fullName: `S17 Live Probe ${probeId}`,
    primaryPhone: patientPhone,
    email: patientEmail,
    dateOfBirth: '1990-04-12',
    gender: 'UNSPECIFIED',
    address: 'S17 verifier synthetic patient',
  };

  const registeredPatient = await phase('reception.create-patient', async () => {
    const patient = await fetchJson(`${apiBaseUrl}/patients`, {
      method: 'POST',
      headers: jsonHeaders(receptionist.accessToken),
      body: JSON.stringify(patientPayload),
    });

    assertStatus(patient.response.status, 201, 'Expected /patients to create a live probe patient.');
    assertSuccessEnvelope(patient.payload, '/patients success path');
    const registered = parseRegisteredPatient(patient.payload);

    verificationState.evidence.registrationNumber = registered.registrationNumber;

    emit('check', {
      check: 'patient-created',
      status: 'ok',
      patientId: registered.id,
      registrationNumber: registered.registrationNumber,
    });

    return registered;
  });

  const scheduledAppointment = await phase('reception.schedule-appointment', async () => {
    const appointmentPayload = {
      patientId: registeredPatient.id,
      doctorUserId: selectedDoctor.id,
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      notes: `S17 live verifier ${probeId}`,
    };

    const appointment = await fetchJson(`${apiBaseUrl}/appointments`, {
      method: 'POST',
      headers: jsonHeaders(receptionist.accessToken),
      body: JSON.stringify(appointmentPayload),
    });

    assertStatus(appointment.response.status, 201, 'Expected /appointments to create a live probe appointment.');
    assertSuccessEnvelope(appointment.payload, '/appointments success path');
    const scheduled = parseScheduledAppointment(appointment.payload);
    assertEqual(scheduled.status, 'SCHEDULED', 'Probe appointment did not start in SCHEDULED state.');
    assertEqual(scheduled.doctorUserId, selectedDoctor.id, 'Probe appointment did not preserve the selected doctor user id.');

    verificationState.evidence.appointmentId = scheduled.id;
    verificationState.evidence.scheduledVersion = scheduled.version;

    emit('check', {
      check: 'appointment-scheduled',
      status: 'ok',
      appointmentId: scheduled.id,
      appointmentStatus: scheduled.status,
      appointmentVersion: scheduled.version,
      doctorUserId: selectedDoctor.id,
      doctorUsername: selectedDoctor.username,
      departmentName: selectedDoctor.departmentName,
    });

    return scheduled;
  });

  await phase('doctor.observe-queue', async () => {
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
  });

  const checkedIn = await phase('doctor.transition-check-in', async () => {
    const currentQueue = await fetchDoctorQueue(doctor.accessToken);
    const current = findQueueEntry(currentQueue, scheduledAppointment.id, 'doctor queue before CHECKED_IN');
    const updated = await patchDoctorQueueAppointment({
      accessToken: doctor.accessToken,
      appointmentId: current.id,
      version: current.version,
      status: 'CHECKED_IN',
    });

    assertEqual(updated.status, 'CHECKED_IN', 'Doctor queue check-in did not return CHECKED_IN.');
    assertEqual(updated.version, current.version + 1, 'Doctor queue check-in did not increment the version by one.');

    verificationState.evidence.checkedInVersion = updated.version;

    emit('check', {
      check: 'doctor-queue-check-in',
      status: 'ok',
      appointmentId: updated.id,
      appointmentVersion: updated.version,
      appointmentStatus: updated.status,
    });

    return updated;
  });

  const completed = await phase('doctor.transition-complete', async () => {
    const queueAfterCheckIn = await fetchDoctorQueue(doctor.accessToken);
    const checkedInQueueEntry = findQueueEntry(
      queueAfterCheckIn,
      scheduledAppointment.id,
      'post CHECKED_IN queue lookup',
    );
    assertEqual(checkedInQueueEntry.status, 'CHECKED_IN', 'Authoritative queue refresh did not show CHECKED_IN.');
    assertEqual(
      checkedInQueueEntry.version,
      checkedIn.version,
      'Authoritative queue refresh returned an unexpected CHECKED_IN version.',
    );

    const updated = await patchDoctorQueueAppointment({
      accessToken: doctor.accessToken,
      appointmentId: checkedInQueueEntry.id,
      version: checkedInQueueEntry.version,
      status: 'COMPLETED',
    });
    assertEqual(updated.status, 'COMPLETED', 'Doctor queue completion did not return COMPLETED.');
    assertEqual(
      updated.version,
      checkedInQueueEntry.version + 1,
      'Doctor queue completion did not increment the version by one.',
    );

    verificationState.evidence.completedVersion = updated.version;

    emit('check', {
      check: 'doctor-queue-completed',
      status: 'ok',
      appointmentId: updated.id,
      appointmentVersion: updated.version,
      appointmentStatus: updated.status,
    });

    return updated;
  });

  await phase('doctor.verify-queue-eviction', async () => {
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
  });

  return {
    admin: {
      role: admin.role,
      username: admin.username,
    },
    receptionist: {
      role: receptionist.role,
      username: receptionist.username,
    },
    doctor: {
      role: doctor.role,
      userId: doctor.userId,
      username: doctor.username,
    },
    department: {
      id: assignedDepartment.id,
      name: assignedDepartment.name,
    },
    appointment: {
      id: scheduledAppointment.id,
      scheduledVersion: scheduledAppointment.version,
      checkedInVersion: checkedIn.version,
      completedVersion: completed.version,
    },
    patient: {
      registrationNumber: registeredPatient.registrationNumber,
    },
  };
}

function emitBrowserChecklist(verification) {
  const checklist = {
    slice: 'S17',
    verifier: 'verify:s17:live',
    sessionStorageKey: SESSION_STORAGE_KEY,
    liveProbe: {
      departmentId: verification.department.id,
      departmentName: verification.department.name,
      assignedDoctorUserId: verification.doctor.userId,
      assignedDoctorUsername: verification.doctor.username,
      appointmentId: verification.appointment.id,
      patientRegistrationNumber: verification.patient.registrationNumber,
      scheduledVersion: verification.appointment.scheduledVersion,
      checkedInVersion: verification.appointment.checkedInVersion,
      completedVersion: verification.appointment.completedVersion,
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
        id: 'admin-live-assignment',
        role: verification.admin.role,
        path: '/app/admin',
        selectors: [
          '[data-testid="app-shell"][data-role="admin"][data-auth-status="authenticated"]',
          '[data-testid="admin-overview-page"]',
          '[data-testid="admin-overview-ready-state"][data-screen-code="READY"][data-screen-status="ready"]',
          '[data-testid="admin-overview-success-state"][data-screen-code="DOCTOR_ASSIGNED"][data-screen-status="success"]',
          `[data-testid="admin-department-card-${verification.department.id}"]`,
          `[data-testid="admin-department-assigned-doctor-${verification.department.id}"]`,
        ],
        expectedValues: {
          departmentId: verification.department.id,
          departmentName: verification.department.name,
          doctorUserId: verification.doctor.userId,
          doctorUsername: verification.doctor.username,
          assignmentCount: '1',
        },
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
          `[data-testid="schedulable-doctor-directory-row-${verification.doctor.userId}"]`,
          '[data-testid="reception-scheduling-success-state"][data-screen-code="SCHEDULED"][data-screen-status="success"]',
          '[data-testid="scheduled-patient-registration-number"]',
          '[data-testid="scheduled-appointment-id"]',
          '[data-testid="scheduled-appointment-version"]',
          '[data-testid="scheduled-appointment-doctor"]',
          '[data-testid="scheduled-appointment-department"]',
        ],
        expectedValues: {
          registrationNumber: verification.patient.registrationNumber,
          appointmentId: verification.appointment.id,
          version: String(verification.appointment.scheduledVersion),
          doctorUsername: verification.doctor.username,
          departmentName: verification.department.name,
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
          `[data-testid="doctor-queue-version-${verification.appointment.id}"]`,
        ],
        expectedValues: {
          appointmentId: verification.appointment.id,
          scheduledVersion: String(verification.appointment.scheduledVersion),
          checkedInVersion: String(verification.appointment.checkedInVersion),
          completedVersion: String(verification.appointment.completedVersion),
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
  };

  assertBrowserChecklistContract(checklist);
  emit('browser-checklist', checklist);
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
  assertEqual(
    expectString(me.payload.data.username, `${username} /auth/me username`),
    resolvedUsername,
    `/auth/me returned the wrong username for ${username}.`,
  );
  assertEqual(
    expectString(me.payload.data.id, `${username} /auth/me id`),
    userId,
    `/auth/me returned the wrong user id for ${username}.`,
  );

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

async function listDepartments(accessToken) {
  const response = await fetchJson(`${apiBaseUrl}/admin/config/departments`, {
    method: 'GET',
    headers: bearerHeaders(accessToken),
  });

  assertStatus(response.response.status, 200, 'Expected admin department list to succeed.');
  assertSuccessEnvelope(response.payload, 'admin department list success path');
  const data = readEnvelopeData(response.payload, 'admin department list');
  if (!Array.isArray(data)) {
    throw new Error('Admin department list data must be an array.');
  }

  return data.map((entry, index) => parseAdminDepartment(entry, `admin department list entry ${index}`));
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

function parseAdminDepartment(value, context) {
  const record = expectRecord(value, context);
  const assignedDoctor = record.assignedDoctor;

  return {
    id: expectString(record.id, `${context}.id`),
    name: expectString(record.name, `${context}.name`),
    assignmentCount: expectNonNegativeInteger(record.assignmentCount, `${context}.assignmentCount`),
    assignedDoctor:
      assignedDoctor === null
        ? null
        : {
            id: expectString(expectRecord(assignedDoctor, `${context}.assignedDoctor`).id, `${context}.assignedDoctor.id`),
            username: expectString(
              expectRecord(assignedDoctor, `${context}.assignedDoctor`).username,
              `${context}.assignedDoctor.username`,
            ),
          },
    createdAt: expectString(record.createdAt, `${context}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${context}.updatedAt`),
  };
}

function parseDoctorDirectory(payload) {
  const data = readEnvelopeData(payload, 'doctor directory');
  if (!Array.isArray(data)) {
    throw new Error('Doctor directory data must be an array.');
  }

  return data.map((entry, index) => {
    const record = expectRecord(entry, `doctor directory entry ${index}`);
    const keys = Object.keys(record).sort();
    if (keys.join(',') !== 'departmentId,departmentName,id,username') {
      throw new Error(`doctor directory entry ${index} exposed unexpected fields: ${keys.join(',')}`);
    }

    return {
      id: expectString(record.id, `doctor directory entry ${index}.id`),
      username: expectString(record.username, `doctor directory entry ${index}.username`),
      departmentId: expectString(record.departmentId, `doctor directory entry ${index}.departmentId`),
      departmentName: expectString(record.departmentName, `doctor directory entry ${index}.departmentName`),
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

function findDepartment(departments, departmentId, context) {
  const department = departments.find((entry) => entry.id === departmentId);
  if (!department) {
    throw new Error(`Department ${departmentId} did not appear in ${context}.`);
  }
  return department;
}

function findQueueEntry(queueEntries, appointmentId, context) {
  const queueEntry = queueEntries.find((entry) => entry.id === appointmentId);
  if (!queueEntry) {
    throw new Error(`Appointment ${appointmentId} did not appear in ${context}.`);
  }
  return queueEntry;
}

function expectAssignedDoctor(value, context) {
  if (!value) {
    throw new Error(`${context} must exist.`);
  }
  return value;
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

function assertBrowserChecklistContract(checklist) {
  const adminAssertion = checklist.assertions.find((entry) => entry.id === 'admin-live-assignment');
  if (!adminAssertion) {
    throw new Error('Browser checklist is missing the admin-live-assignment assertion.');
  }

  if (adminAssertion.selectors.some((selector) => selector.includes('CONTRACT_PENDING'))) {
    throw new Error('Browser checklist reused stale CONTRACT_PENDING admin selectors.');
  }

  const requiredIds = new Set([
    'admin-live-assignment',
    'reception-scheduling-success',
    'doctor-queue-lifecycle',
    'receptionist-admin-denied',
    'refresh-fail-closed',
  ]);

  for (const requiredId of requiredIds) {
    if (!checklist.assertions.some((entry) => entry.id === requiredId)) {
      throw new Error(`Browser checklist is missing the ${requiredId} assertion.`);
    }
  }
}

function sanitizedEvidence() {
  const snapshot = {
    departmentId: verificationState.evidence.departmentId,
    departmentName: verificationState.evidence.departmentName,
    assignedDoctorId: verificationState.evidence.assignedDoctorId,
    assignedDoctorUsername: verificationState.evidence.assignedDoctorUsername,
    registrationNumber: verificationState.evidence.registrationNumber,
    appointmentId: verificationState.evidence.appointmentId,
    scheduledVersion: verificationState.evidence.scheduledVersion,
    checkedInVersion: verificationState.evidence.checkedInVersion,
    completedVersion: verificationState.evidence.completedVersion,
  };

  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== undefined));
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

function expectNonNegativeInteger(value, context) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative integer.`);
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
    throw new Error(`S17_VERIFY_TIMEOUT_MS must be a positive number, received ${String(value)}.`);
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
  console.error(
    JSON.stringify({
      event: 'result',
      verifier: 'S17',
      status: 'error',
      phase: verificationState.currentPhase,
      lastSuccessfulPhase: verificationState.lastSuccessfulPhase,
      proof: sanitizedEvidence(),
      message,
    }),
  );
  process.exit(1);
});
