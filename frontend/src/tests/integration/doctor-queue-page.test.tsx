import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY } from '@/lib/auth/session';
import {
  apiErrorResponse,
  authSuccessResponse,
  renderApp,
} from '@/tests/test-utils/render-app';

const fetchMock = vi.fn<typeof fetch>();

const HANDOFF_APPOINTMENT_ID = 'appointment-s16-handoff';
const HANDOFF_PATIENT_ID = 'patient-s16-handoff';
const HANDOFF_PATIENT_NAME = 'Jane Doe';
const HANDOFF_REGISTRATION_NUMBER = 'REG-S16-1001';

describe('doctor queue page integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.sessionStorage.clear();
  });

  it('polls the live queue, sends current versions, and removes completed visits after authoritative refetch', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        queueAppointment({
          id: HANDOFF_APPOINTMENT_ID,
          patientId: HANDOFF_PATIENT_ID,
          patientName: HANDOFF_PATIENT_NAME,
          registrationNumber: HANDOFF_REGISTRATION_NUMBER,
          status: 'SCHEDULED',
          version: 1,
        }),
      ]),
      doctorQueueMutationResponse({
        id: HANDOFF_APPOINTMENT_ID,
        patientId: HANDOFF_PATIENT_ID,
        patientName: HANDOFF_PATIENT_NAME,
        registrationNumber: HANDOFF_REGISTRATION_NUMBER,
        status: 'CHECKED_IN',
        version: 2,
      }),
      doctorQueueResponse([
        queueAppointment({
          id: HANDOFF_APPOINTMENT_ID,
          patientId: HANDOFF_PATIENT_ID,
          patientName: HANDOFF_PATIENT_NAME,
          registrationNumber: HANDOFF_REGISTRATION_NUMBER,
          status: 'CHECKED_IN',
          version: 2,
        }),
      ]),
      doctorQueueMutationResponse({
        id: HANDOFF_APPOINTMENT_ID,
        patientId: HANDOFF_PATIENT_ID,
        patientName: HANDOFF_PATIENT_NAME,
        registrationNumber: HANDOFF_REGISTRATION_NUMBER,
        status: 'COMPLETED',
        version: 3,
      }),
      doctorQueueResponse([]),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user);

    const initialItem = await screen.findByTestId(`doctor-queue-item-${HANDOFF_APPOINTMENT_ID}`);
    expect(initialItem).toHaveAttribute('data-appointment-id', HANDOFF_APPOINTMENT_ID);
    expect(initialItem).toHaveAttribute('data-appointment-status', 'SCHEDULED');
    expect(initialItem).toHaveAttribute('data-appointment-version', '1');
    expect(screen.getByTestId('doctor-queue-polling-badge')).toHaveTextContent('Polling every 15s');
    expect(screen.getByText(HANDOFF_REGISTRATION_NUMBER)).toBeInTheDocument();

    await user.click(screen.getByTestId(`queue-action-check-in-${HANDOFF_APPOINTMENT_ID}`));

    const checkedInState = await screen.findByTestId('doctor-queue-action-success-state');
    expect(checkedInState).toHaveAttribute('data-screen-code', 'CHECKED_IN');
    expect(screen.getByTestId('doctor-queue-last-version')).toHaveTextContent('2');

    const refreshedItem = await screen.findByTestId(`doctor-queue-item-${HANDOFF_APPOINTMENT_ID}`);
    expect(refreshedItem).toHaveAttribute('data-appointment-status', 'CHECKED_IN');
    expect(refreshedItem).toHaveAttribute('data-appointment-version', '2');
    expect(screen.getByTestId(`doctor-queue-version-${HANDOFF_APPOINTMENT_ID}`)).toHaveTextContent('2');
    expect(screen.getByTestId(`queue-action-complete-${HANDOFF_APPOINTMENT_ID}`)).toHaveAttribute(
      'data-next-status',
      'COMPLETED',
    );
    expect(screen.getByTestId(`queue-action-complete-${HANDOFF_APPOINTMENT_ID}`)).toBeInTheDocument();

    await user.click(screen.getByTestId(`queue-action-complete-${HANDOFF_APPOINTMENT_ID}`));

    const completedState = await screen.findByTestId('doctor-queue-action-success-state');
    expect(completedState).toHaveAttribute('data-screen-code', 'COMPLETED');
    expect(completedState).toHaveAttribute('data-last-appointment-id', HANDOFF_APPOINTMENT_ID);
    expect(completedState).toHaveAttribute('data-last-appointment-status', 'COMPLETED');
    expect(completedState).toHaveAttribute('data-last-appointment-version', '3');

    const emptyState = await screen.findByTestId('doctor-queue-empty-state');
    expect(screen.getByTestId('doctor-queue-page')).toHaveAttribute('data-active-queue-count', '0');
    expect(emptyState).toHaveAttribute('data-screen-code', 'EMPTY_QUEUE');
    expect(screen.queryByTestId(`doctor-queue-item-${HANDOFF_APPOINTMENT_ID}`)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/doctor/queue');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`http://localhost:3000/api/v1/doctor/queue/${HANDOFF_APPOINTMENT_ID}`);
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://localhost:3000/api/v1/doctor/queue');
    expect(fetchMock.mock.calls[4]?.[0]).toBe(`http://localhost:3000/api/v1/doctor/queue/${HANDOFF_APPOINTMENT_ID}`);
    expect(fetchMock.mock.calls[5]?.[0]).toBe('http://localhost:3000/api/v1/doctor/queue');

    const firstPatchBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    const secondPatchBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(firstPatchBody).toEqual({ status: 'CHECKED_IN', version: 1 });
    expect(secondPatchBody).toEqual({ status: 'COMPLETED', version: 2 });
  });

  it('renders an explicit unavailable state when the live queue read fails', async () => {
    seedDoctorLogin([apiErrorResponse(503, 'OPD_UNAVAILABLE', 'Queue unavailable.')]);

    const user = userEvent.setup();
    await loginToQueue(user, { waitForQueue: false });

    const unavailableState = await screen.findByTestId('doctor-queue-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(screen.queryByTestId('doctor-queue-list')).not.toBeInTheDocument();
  });

  it('surfaces version conflicts without pretending the queue update succeeded', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        queueAppointment({ id: 'appointment-2', status: 'CHECKED_IN', version: 2 }),
      ]),
      apiErrorResponse(409, 'APPOINTMENT_VERSION_CONFLICT', 'Appointment version conflict.'),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user);
    await user.click(screen.getByTestId('queue-action-complete-appointment-2'));

    const conflictState = await screen.findByTestId('doctor-queue-action-conflict-state');
    expect(conflictState).toHaveAttribute('data-screen-code', 'CONFLICT');
    expect(screen.getByTestId('doctor-queue-item-appointment-2')).toHaveAttribute(
      'data-appointment-version',
      '2',
    );
  });

  it('maps invalid lifecycle transitions to an explicit conflict state', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        queueAppointment({ id: 'appointment-3', status: 'CHECKED_IN', version: 2 }),
      ]),
      apiErrorResponse(
        422,
        'APPOINTMENT_INVALID_STATUS_TRANSITION',
        'Doctor queue transition is not allowed.',
      ),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user);
    await user.click(screen.getByTestId('queue-action-complete-appointment-3'));

    const conflictState = await screen.findByTestId('doctor-queue-action-conflict-state');
    expect(conflictState).toHaveAttribute('data-screen-code', 'APPOINTMENT_INVALID_STATUS_TRANSITION');
  });

  it('preserves forbidden queue writes in the machine-readable action state', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        queueAppointment({ id: 'appointment-4', status: 'SCHEDULED', version: 1 }),
      ]),
      apiErrorResponse(403, 'FORBIDDEN', 'Role is not permitted for this resource.'),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user);
    await user.click(screen.getByTestId('queue-action-check-in-appointment-4'));

    const forbiddenState = await screen.findByTestId('doctor-queue-action-forbidden-state');
    expect(forbiddenState).toHaveAttribute('data-screen-code', 'FORBIDDEN');
    expect(forbiddenState).toHaveAttribute('data-screen-status', 'forbidden');
  });

  it('fails closed on malformed queue payloads such as missing version fields', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        {
          ...queueAppointment({ id: 'appointment-5', status: 'SCHEDULED', version: 1 }),
          version: undefined,
        },
      ]),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user, { waitForQueue: false });

    const unavailableState = await screen.findByTestId('doctor-queue-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
  });

  it('fails closed on malformed queue envelopes that omit the data array', async () => {
    seedDoctorLogin([
      jsonResponse(
        {
          success: true,
        },
        200,
      ),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user, { waitForQueue: false });

    const unavailableState = await screen.findByTestId('doctor-queue-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
  });

  it('fails closed on unsupported active queue statuses from the backend', async () => {
    seedDoctorLogin([
      doctorQueueResponse([
        queueAppointment({ id: 'appointment-6', status: 'COMPLETED', version: 3 }),
      ]),
    ]);

    const user = userEvent.setup();
    await loginToQueue(user, { waitForQueue: false });

    const unavailableState = await screen.findByTestId('doctor-queue-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
  });

  it('shows the explicit empty-queue state when no active appointments exist', async () => {
    seedDoctorLogin([doctorQueueResponse([])]);

    const user = userEvent.setup();
    await loginToQueue(user);

    const emptyState = await screen.findByTestId('doctor-queue-empty-state');
    expect(emptyState).toHaveAttribute('data-screen-code', 'EMPTY_QUEUE');
    expect(screen.getByTestId('doctor-queue-action-ready-state')).toHaveAttribute(
      'data-screen-code',
      'READY',
    );
  });

  it('replays queue loading once after refresh recovery and renders the live doctor queue', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'stale-token',
          role: 'doctor',
          userId: 'user-3',
          username: 'doctor',
        }),
      )
      .mockResolvedValueOnce(apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.'))
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'fresh-token',
          role: 'doctor',
          userId: 'user-3',
          username: 'doctor',
        }),
      )
      .mockResolvedValueOnce(
        doctorQueueResponse([
          queueAppointment({ id: 'appointment-7', status: 'SCHEDULED', version: 1 }),
        ]),
      );

    const user = userEvent.setup();
    await loginToQueue(user);

    const queueItem = await screen.findByTestId('doctor-queue-item-appointment-7');
    expect(queueItem).toHaveAttribute('data-appointment-status', 'SCHEDULED');

    await waitFor(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('fresh-token');
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/v1/auth/login');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/doctor/queue');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://localhost:3000/api/v1/doctor/queue');

    const initialHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    const replayHeaders = new Headers(fetchMock.mock.calls[3]?.[1]?.headers);
    expect(initialHeaders.get('Authorization')).toBe('Bearer stale-token');
    expect(replayHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });
});

function seedDoctorLogin(queueResponses: Response[]) {
  fetchMock.mockResolvedValueOnce(
    authSuccessResponse({
      accessToken: 'doctor-token',
      role: 'doctor',
      userId: 'user-3',
      username: 'doctor',
    }),
  );

  for (const response of queueResponses) {
    fetchMock.mockResolvedValueOnce(response);
  }
}

async function loginToQueue(
  user: ReturnType<typeof userEvent.setup>,
  options: { waitForQueue?: boolean } = {},
) {
  renderApp({ initialEntries: ['/login'] });

  await user.type(screen.getByTestId('username-input'), 'doctor');
  await user.type(screen.getByTestId('password-input'), 'secret123');
  await user.click(screen.getByTestId('login-submit-button'));
  await screen.findByTestId('app-shell');

  if (options.waitForQueue !== false) {
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[0] === 'http://localhost:3000/api/v1/doctor/queue')).toBe(true);
    });
  }
}

function doctorQueueResponse(data: unknown[]) {
  return jsonResponse(
    {
      success: true,
      data,
    },
    200,
  );
}

function doctorQueueMutationResponse(overrides: {
  id: string;
  patientId?: string;
  patientName?: string;
  registrationNumber?: string;
  status: 'CHECKED_IN' | 'COMPLETED';
  version: number;
}) {
  return jsonResponse(
    {
      success: true,
      data: {
        ...queueAppointment({
          id: overrides.id,
          status: overrides.status,
          version: overrides.version,
        }),
      },
    },
    200,
  );
}

function queueAppointment(overrides: {
  id: string;
  patientId?: string;
  patientName?: string;
  registrationNumber?: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED';
  version: number;
}) {
  return {
    id: overrides.id,
    patientId: overrides.patientId ?? `patient-${overrides.id}`,
    doctorUserId: 'user-3',
    scheduledAt: '2026-05-20T02:30:00.000Z',
    durationMinutes: 30,
    status: overrides.status,
    version: overrides.version,
    createdAt: '2026-05-20T01:45:00.000Z',
    updatedAt: '2026-05-20T01:45:00.000Z',
    patient: {
      id: overrides.patientId ?? `patient-${overrides.id}`,
      registrationNumber: overrides.registrationNumber ?? `REG-${overrides.id}`,
      fullName: overrides.patientName ?? `Patient ${overrides.id}`,
      primaryPhone: '+1555000111',
      dateOfBirth: null,
      gender: 'UNSPECIFIED',
    },
  };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
