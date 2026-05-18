import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY } from '@/lib/auth/session';
import {
  apiErrorResponse,
  authSuccessResponse,
  renderApp,
} from '@/tests/test-utils/render-app';

const DOCTORS = [
  { id: 'doctor-1', username: 'doctor.alex' },
  { id: 'doctor-2', username: 'doctor.sam' },
] as const;

const HANDOFF_APPOINTMENT_ID = 'appointment-s16-handoff';
const HANDOFF_PATIENT_ID = 'patient-s16-handoff';
const HANDOFF_REGISTRATION_NUMBER = 'REG-S16-1001';
const HANDOFF_DOCTOR_ID = 'doctor-2';
const HANDOFF_DOCTOR_USERNAME = 'doctor.sam';

const fetchMock = vi.fn<typeof fetch>();

describe('scheduling page integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.sessionStorage.clear();
  });

  it('registers the patient before creating the appointment and lands a machine-readable success state', async () => {
    seedReceptionLogin();
    fetchMock
      .mockResolvedValueOnce(patientResponse())
      .mockResolvedValueOnce(appointmentResponse());

    const user = userEvent.setup();
    await loginToScheduling(user);

    await fillSchedulingForm(user);
    await user.click(screen.getByTestId('schedule-submit-button'));

    const successState = await screen.findByTestId('reception-scheduling-success-state');
    expect(successState).toHaveAttribute('data-screen-code', 'SCHEDULED');
    expect(successState).toHaveAttribute('data-screen-status', 'success');
    expect(screen.getByTestId('scheduled-patient-registration-number')).toHaveTextContent(HANDOFF_REGISTRATION_NUMBER);
    expect(screen.getByTestId('scheduled-appointment-id')).toHaveTextContent(HANDOFF_APPOINTMENT_ID);
    expect(screen.getByTestId('scheduled-appointment-status')).toHaveTextContent('SCHEDULED');
    expect(screen.getByTestId('scheduled-appointment-version')).toHaveTextContent('1');
    expect(screen.getByTestId('scheduled-appointment-doctor')).toHaveTextContent(HANDOFF_DOCTOR_USERNAME);
    expect(screen.queryByLabelText(/doctorUserId/i)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/patients');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://localhost:3000/api/v1/appointments');

    const patientBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    const appointmentBody = JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body));
    expect(patientBody).toMatchObject({
      fullName: 'Jane Doe',
      primaryPhone: '+1555000111',
    });
    expect(appointmentBody).toMatchObject({
      doctorUserId: HANDOFF_DOCTOR_ID,
      patientId: HANDOFF_PATIENT_ID,
    });
  }, 10000);


  it('keeps the screen fail closed when the doctor directory is unavailable', async () => {
    seedReceptionLogin({ doctorsResponse: apiErrorResponse(503, 'OPD_UNAVAILABLE', 'Directory unavailable.') });

    const user = userEvent.setup();
    await loginToScheduling(user, { waitForDoctorSelect: false });

    const unavailableState = await screen.findByTestId('reception-scheduling-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(unavailableState).toHaveAttribute('data-screen-status', 'unavailable');
    expect(screen.queryByTestId('reception-scheduling-form')).not.toBeInTheDocument();
  });

  it('halts after patient creation failure and never attempts appointment creation', async () => {
    seedReceptionLogin();
    fetchMock.mockResolvedValueOnce(apiErrorResponse(503, 'OPD_UNAVAILABLE', 'Patient store unavailable.'));

    const user = userEvent.setup();
    await loginToScheduling(user);

    await fillSchedulingForm(user);
    await user.click(screen.getByTestId('schedule-submit-button'));

    const unavailableState = await screen.findByTestId('reception-scheduling-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain(
      'http://localhost:3000/api/v1/appointments',
    );
  });

  it('preserves forbidden appointment errors in the UI mapping', async () => {
    seedReceptionLogin();
    fetchMock
      .mockResolvedValueOnce(patientResponse())
      .mockResolvedValueOnce(apiErrorResponse(403, 'NOT_ALLOWED', 'Reception booking forbidden.'));

    const user = userEvent.setup();
    await loginToScheduling(user);

    await fillSchedulingForm(user);
    await user.click(screen.getByTestId('schedule-submit-button'));

    const forbiddenState = await screen.findByTestId('reception-scheduling-forbidden-state');
    expect(forbiddenState).toHaveAttribute('data-screen-code', 'FORBIDDEN');
    expect(forbiddenState).toHaveAttribute('data-screen-status', 'forbidden');
  });

  it('replays the patient registration once after refresh recovery and then finishes booking', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'stale-token',
          role: 'receptionist',
          userId: 'user-2',
          username: 'reception',
        }),
      )
      .mockResolvedValueOnce(doctorDirectoryResponse())
      .mockResolvedValueOnce(
        apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.'),
      )
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'fresh-token',
          role: 'receptionist',
          userId: 'user-2',
          username: 'reception',
        }),
      )
      .mockResolvedValueOnce(patientResponse())
      .mockResolvedValueOnce(appointmentResponse());

    const user = userEvent.setup();
    await loginToScheduling(user);

    await fillSchedulingForm(user);
    await user.click(screen.getByTestId('schedule-submit-button'));

    const successState = await screen.findByTestId('reception-scheduling-success-state');
    expect(successState).toHaveAttribute('data-screen-code', 'SCHEDULED');

    await waitFor(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('fresh-token');
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/patients');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://localhost:3000/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[4]?.[0]).toBe('http://localhost:3000/api/v1/patients');

    const staleHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    const replayHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);
    expect(staleHeaders.get('Authorization')).toBe('Bearer stale-token');
    expect(replayHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('rejects malformed inputs without touching the backend mutations', async () => {
    seedReceptionLogin();

    const user = userEvent.setup();
    await loginToScheduling(user);
    fireEvent.submit(screen.getByTestId('reception-scheduling-form'));

    const validationState = await screen.findByTestId('reception-scheduling-validation-state');
    expect(validationState).toHaveAttribute('data-screen-code', 'INVALID_FORM');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function seedReceptionLogin(options: { doctorsResponse?: Response } = {}) {
  fetchMock
    .mockResolvedValueOnce(
      authSuccessResponse({
        accessToken: 'reception-token',
        role: 'receptionist',
        userId: 'user-2',
        username: 'reception',
      }),
    )
    .mockResolvedValueOnce(options.doctorsResponse ?? doctorDirectoryResponse());
}

async function loginToScheduling(
  user: ReturnType<typeof userEvent.setup>,
  options: { waitForDoctorSelect?: boolean } = {},
) {
  renderApp({ initialEntries: ['/login'] });

  await user.type(screen.getByTestId('username-input'), 'reception');
  await user.type(screen.getByTestId('password-input'), 'secret123');
  await user.click(screen.getByTestId('login-submit-button'));
  await screen.findByTestId('app-shell');

  if (options.waitForDoctorSelect !== false) {
    await screen.findByTestId('appointment-doctor-select');
  }
}

async function fillSchedulingForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('patient-full-name-input'), 'Jane Doe');
  await user.type(screen.getByTestId('patient-primary-phone-input'), '+1555000111');
  await user.type(screen.getByTestId('patient-email-input'), 'jane@example.com');
  await user.selectOptions(screen.getByTestId('appointment-doctor-select'), HANDOFF_DOCTOR_ID);
  fireEvent.change(screen.getByTestId('appointment-scheduled-at-input'), {
    target: { value: '2026-05-20T09:30' },
  });
  fireEvent.change(screen.getByTestId('appointment-duration-minutes-input'), {
    target: { value: '45' },
  });
  await user.type(screen.getByTestId('appointment-notes-input'), 'First consultation');
}

function doctorDirectoryResponse() {
  return jsonResponse(
    {
      success: true,
      data: [...DOCTORS],
    },
    200,
  );
}

function patientResponse() {
  return jsonResponse(
    {
      success: true,
      data: {
        id: HANDOFF_PATIENT_ID,
        registrationNumber: HANDOFF_REGISTRATION_NUMBER,
        fullName: 'Jane Doe',
        primaryPhone: '+1555000111',
        email: 'jane@example.com',
        dateOfBirth: null,
        gender: 'UNSPECIFIED',
        address: null,
        createdAt: '2026-05-15T09:00:00.000Z',
        updatedAt: '2026-05-15T09:00:00.000Z',
      },
    },
    201,
  );
}

function appointmentResponse() {
  return jsonResponse(
    {
      success: true,
      data: {
        id: HANDOFF_APPOINTMENT_ID,
        patientId: HANDOFF_PATIENT_ID,
        doctorUserId: HANDOFF_DOCTOR_ID,
        scheduledAt: '2026-05-20T02:30:00.000Z',
        durationMinutes: 45,
        status: 'SCHEDULED',
        notes: 'First consultation',
        version: 1,
        createdAt: '2026-05-15T09:01:00.000Z',
        updatedAt: '2026-05-15T09:01:00.000Z',
      },
    },
    201,
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
