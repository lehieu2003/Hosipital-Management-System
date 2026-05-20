import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiErrorResponse,
  authSuccessResponse,
  jsonResponse,
  meSuccessResponse,
  renderApp,
  storeSession,
} from '@/tests/test-utils/render-app';

const fetchMock = vi.fn<typeof fetch>();

const OCCUPANCY_ENTRY = {
  id: 'occupancy-1',
  admissionId: 'admission-1',
  bedId: 'bed-a1',
  assignedByUserId: 'user-2',
  assignedAt: '2026-05-17T08:05:00.000Z',
  lastTransferredAt: null,
  version: 3,
  createdAt: '2026-05-17T08:05:00.000Z',
  updatedAt: '2026-05-17T08:05:00.000Z',
  bed: {
    id: 'bed-a1',
    bedNumber: 'A1',
    wardName: 'North Ward',
    roomNumber: '101',
    isActive: true,
    createdAt: '2026-05-17T08:00:00.000Z',
    updatedAt: '2026-05-17T08:00:00.000Z',
  },
  assignedByUser: {
    id: 'user-2',
    username: 'reception',
    role: 'RECEPTIONIST',
    isActive: true,
  },
  admission: {
    id: 'admission-1',
    patientId: 'patient-1',
    status: 'ADMITTED',
    admittedAt: '2026-05-17T08:00:00.000Z',
    dischargeAt: null,
    version: 4,
    patient: {
      id: 'patient-1',
      registrationNumber: 'REG-1001',
      fullName: 'Jane Doe',
      primaryPhone: '+1555000111',
    },
  },
} as const;

const MOVEMENT_HISTORY = [
  {
    id: 'movement-1',
    admissionId: 'admission-1',
    movementType: 'ASSIGNED',
    fromBedId: null,
    toBedId: 'bed-a1',
    movedByUserId: 'user-2',
    movedAt: '2026-05-17T08:05:00.000Z',
    note: 'Initial bed placement',
    createdAt: '2026-05-17T08:05:00.000Z',
    fromBed: null,
    toBed: OCCUPANCY_ENTRY.bed,
    movedByUser: OCCUPANCY_ENTRY.assignedByUser,
  },
] as const;

describe('inpatients page integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.sessionStorage.clear();
  });

  it('renders the reception inpatient workspace with live occupancy and a machine-readable success state', async () => {
    seedReceptionLogin();
    fetchMock
      .mockResolvedValueOnce(ipdOccupancyResponse([OCCUPANCY_ENTRY]))
      .mockResolvedValueOnce(ipdMovementsResponse(MOVEMENT_HISTORY))
      .mockResolvedValueOnce(admitResponse())
      .mockResolvedValueOnce(ipdMovementsResponse([]));

    const user = userEvent.setup();
    await loginToInpatients(user);

    const appShell = await screen.findByTestId('app-shell');
    expect(appShell).toHaveAttribute('data-current-path', '/app/reception/inpatients');
    expect(appShell).toHaveAttribute('data-role', 'receptionist');
    expect(screen.getByRole('link', { name: 'Inpatients' })).toHaveAttribute('href', '/app/reception/inpatients');
    expect(await screen.findByTestId('reception-inpatients-page')).toHaveAttribute('data-occupancy-count', '1');
    expect(await screen.findByTestId('reception-inpatients-history-list')).toBeInTheDocument();

    await user.type(screen.getByTestId('ipd-patient-id-input'), 'patient-2');
    await user.type(screen.getByTestId('ipd-attending-doctor-input'), 'doctor-7');
    await user.type(screen.getByTestId('ipd-admission-notes-input'), 'Admit from emergency intake');
    await user.click(screen.getByTestId('ipd-admit-submit-button'));

    const successState = await screen.findByTestId('reception-inpatients-success-state');
    expect(successState).toHaveAttribute('data-screen-code', 'ADMISSION_CREATED');
    expect(successState).toHaveAttribute('data-screen-status', 'success');
    expect(successState).toHaveAttribute('data-selected-admission-id', 'admission-2');
    expect(successState).toHaveAttribute('data-selected-admission-version', '1');
    expect(screen.getByTestId('reception-inpatients-history-empty-state')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/ipd/occupancy');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://localhost:3000/api/v1/ipd/admissions/admission-1/movements');
    expect(fetchMock.mock.calls[4]?.[0]).toBe('http://localhost:3000/api/v1/ipd/admissions');

    const admissionRequestBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(admissionRequestBody).toMatchObject({
      attendingDoctorUserId: 'doctor-7',
      notes: 'Admit from emergency intake',
      patientId: 'patient-2',
    });
  });

  it('fails closed with a forbidden marker when occupancy access is denied', async () => {
    seedReceptionLogin();
    fetchMock.mockResolvedValueOnce(apiErrorResponse(403, 'NOT_ALLOWED', 'Occupancy access denied.'));

    const user = userEvent.setup();
    await loginToInpatients(user, { waitForPage: false });

    const forbiddenState = await screen.findByTestId('reception-inpatients-forbidden-state');
    expect(forbiddenState).toHaveAttribute('data-screen-code', 'FORBIDDEN');
    expect(forbiddenState).toHaveAttribute('data-screen-status', 'forbidden');
    expect(screen.queryByTestId('ipd-admit-submit-button')).not.toBeInTheDocument();
  });

  it('fails closed with an unavailable marker when the live occupancy contract degrades', async () => {
    seedReceptionLogin();
    fetchMock.mockResolvedValueOnce(apiErrorResponse(503, 'IPD_UNAVAILABLE', 'Occupancy board unavailable.'));

    const user = userEvent.setup();
    await loginToInpatients(user, { waitForPage: false });

    const unavailableState = await screen.findByTestId('reception-inpatients-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(unavailableState).toHaveAttribute('data-screen-status', 'unavailable');
    expect(screen.queryByTestId('ipd-admit-submit-button')).not.toBeInTheDocument();
  });

  it('preserves backend conflict codes when a bed workflow collides with live state', async () => {
    seedReceptionLogin();
    fetchMock
      .mockResolvedValueOnce(ipdOccupancyResponse([OCCUPANCY_ENTRY]))
      .mockResolvedValueOnce(ipdMovementsResponse(MOVEMENT_HISTORY))
      .mockResolvedValueOnce(apiErrorResponse(409, 'BED_ALREADY_OCCUPIED', 'Bed already occupied.'));

    const user = userEvent.setup();
    await loginToInpatients(user);

    await screen.findByTestId('reception-inpatients-page');
    await user.clear(screen.getByTestId('ipd-bed-id-input'));
    await user.type(screen.getByTestId('ipd-bed-id-input'), 'bed-b2');
    await user.click(screen.getByTestId('ipd-assign-submit-button'));

    const conflictState = await screen.findByTestId('reception-inpatients-conflict-state');
    expect(conflictState).toHaveAttribute('data-screen-code', 'BED_ALREADY_OCCUPIED');
    expect(conflictState).toHaveAttribute('data-screen-status', 'conflict');
    expect(screen.getByTestId('reception-inpatients-conflict-note')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4]?.[0]).toBe('http://localhost:3000/api/v1/ipd/admissions/admission-1/bed-assignment');

    const assignRequestBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(assignRequestBody).toMatchObject({
      bedId: 'bed-b2',
      expectedAdmissionVersion: 4,
      note: null,
    });
  });

  it('blocks non-reception roles at the route boundary before any inpatient fetch runs', async () => {
    storeSession({
      accessToken: 'doctor-token',
      role: 'doctor',
      userId: 'doctor-1',
      username: 'doctor',
    });
    fetchMock.mockResolvedValueOnce(
      meSuccessResponse({
        role: 'doctor',
        userId: 'doctor-1',
        username: 'doctor',
      }),
    );

    renderApp({ initialEntries: ['/app/reception/inpatients'] });

    const routeForbidden = await screen.findByTestId('route-forbidden-state');
    expect(routeForbidden).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/v1/auth/me');
  });
});

function seedReceptionLogin() {
  fetchMock
    .mockResolvedValueOnce(
      authSuccessResponse({
        accessToken: 'reception-token',
        role: 'receptionist',
        userId: 'user-2',
        username: 'reception',
      }),
    )
    .mockResolvedValueOnce(doctorDirectoryResponse());
}

async function loginToInpatients(
  user: ReturnType<typeof userEvent.setup>,
  options: { waitForPage?: boolean } = {},
) {
  renderApp({ initialEntries: ['/login'] });

  await user.type(screen.getByTestId('username-input'), 'reception');
  await user.type(screen.getByTestId('password-input'), 'secret123');
  await user.click(screen.getByTestId('login-submit-button'));
  await screen.findByTestId('app-shell');
  await user.click(screen.getByRole('link', { name: 'Inpatients' }));

  if (options.waitForPage !== false) {
    await screen.findByTestId('reception-inpatients-page');
  }
}

function ipdOccupancyResponse(data: unknown) {
  return jsonResponse({ success: true, data }, { status: 200 });
}

function ipdMovementsResponse(data: unknown) {
  return jsonResponse({ success: true, data }, { status: 200 });
}

function doctorDirectoryResponse() {
  return jsonResponse(
    {
      success: true,
      data: [
        {
          id: 'doctor-7',
          username: 'doctor.ward',
          departmentId: 'department-general',
          departmentName: 'General Medicine',
        },
      ],
    },
    { status: 200 },
  );
}

function admitResponse() {
  return jsonResponse(
    {
      success: true,
      data: {
        id: 'admission-2',
        patientId: 'patient-2',
        status: 'ADMITTED',
        attendingDoctorUserId: 'doctor-7',
        admittedByUserId: 'user-2',
        admittedAt: '2026-05-17T10:00:00.000Z',
        dischargeAt: null,
        dischargeNotes: null,
        dischargedByUserId: null,
        notes: 'Admit from emergency intake',
        version: 1,
        createdAt: '2026-05-17T10:00:00.000Z',
        updatedAt: '2026-05-17T10:00:00.000Z',
        currentBedOccupancy: null,
      },
    },
    { status: 201 },
  );
}
