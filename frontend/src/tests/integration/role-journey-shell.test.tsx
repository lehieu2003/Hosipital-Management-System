import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiErrorResponse,
  authSuccessResponse,
  renderApp,
  storeSession,
} from '@/tests/test-utils/render-app';

describe('role journey shell integration', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.sessionStorage.clear();
  });

  it('routes seeded admin login to the real home shell', async () => {
    fetchMock.mockResolvedValueOnce(
      authSuccessResponse({
        accessToken: 'admin-token',
        role: 'admin',
        username: 'admin',
      }),
    );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'admin');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');

    const location = screen.getByTestId('router-location');
    await waitFor(() => {
      expect(location).toHaveAttribute('data-pathname', '/app/admin');
    });

    const state = await screen.findByTestId('admin-overview-unavailable-state');
    expect(state).toHaveAttribute('data-screen-code', 'CONTRACT_PENDING');
    expect(state).toHaveAttribute('data-screen-status', 'unavailable');
  });

  it('routes seeded receptionist login to the live scheduling shell', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'receptionist-token',
          role: 'receptionist',
          username: 'reception',
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [{ id: 'doctor-1', username: 'doctor.alex' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'reception');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'receptionist');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');

    const location = screen.getByTestId('router-location');
    await waitFor(() => {
      expect(location).toHaveAttribute('data-pathname', '/app/reception/scheduling');
    });

    expect(await screen.findByTestId('reception-scheduling-page')).toBeInTheDocument();
    const readyState = await screen.findByTestId('reception-scheduling-ready-state');
    expect(readyState).toHaveAttribute('data-screen-code', 'READY');
    expect(readyState).toHaveAttribute('data-screen-status', 'idle');
    expect(screen.getByTestId('appointment-doctor-select')).toBeInTheDocument();
    expect(screen.queryByTestId('reception-scheduling-unavailable-state')).not.toBeInTheDocument();
  });

  it('routes seeded doctor login to the live queue shell', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'doctor-token',
          role: 'doctor',
          username: 'doctor',
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: 'appointment-1',
                patientId: 'patient-1',
                doctorUserId: 'user-1',
                scheduledAt: '2026-05-20T02:30:00.000Z',
                durationMinutes: 30,
                status: 'SCHEDULED',
                version: 1,
                createdAt: '2026-05-20T01:45:00.000Z',
                updatedAt: '2026-05-20T01:45:00.000Z',
                patient: {
                  id: 'patient-1',
                  registrationNumber: 'REG-1001',
                  fullName: 'Queue Patient',
                  primaryPhone: '+1555000111',
                  dateOfBirth: null,
                  gender: 'UNSPECIFIED',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'doctor');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'doctor');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');

    const location = screen.getByTestId('router-location');
    await waitFor(() => {
      expect(location).toHaveAttribute('data-pathname', '/app/doctor/queue');
    });

    expect(await screen.findByTestId('doctor-queue-page')).toBeInTheDocument();
    const queueItem = await screen.findByTestId('doctor-queue-item-appointment-1');
    expect(queueItem).toHaveAttribute('data-appointment-status', 'SCHEDULED');
    expect(screen.getByTestId('doctor-queue-action-ready-state')).toHaveAttribute('data-screen-code', 'READY');
    expect(screen.queryByTestId('doctor-queue-unavailable-state')).not.toBeInTheDocument();
  });

  it('renders the login boundary for anonymous access to protected routes', async () => {
    renderApp({ initialEntries: ['/app/admin'] });

    const loginPage = await screen.findByTestId('login-page');
    expect(loginPage).toHaveAttribute('data-auth-status', 'anonymous');
    expect(loginPage).toHaveAttribute('data-session-notice', 'signed-out');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
  });

  it('fails closed on direct receptionist access to an admin-only route', async () => {
    storeSession({
      accessToken: 'reception-token',
      role: 'receptionist',
      userId: 'user-2',
      username: 'reception',
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'user-2',
            username: 'reception',
            role: 'receptionist',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderApp({ initialEntries: ['/app/admin'] });

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'receptionist');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/app/admin');

    expect(await screen.findByTestId('route-forbidden-state')).toBeInTheDocument();
  });

  it('surfaces explicit invalid-credential feedback on wrong passwords', async () => {
    fetchMock.mockResolvedValueOnce(
      apiErrorResponse(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.'),
    );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'wrong-password');
    await user.click(screen.getByTestId('login-submit-button'));

    const errorBanner = await screen.findByTestId('login-error-banner');
    expect(errorBanner).toHaveAttribute('data-error-code', 'INVALID_CREDENTIALS');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
  });

  it('keeps unexpected auth error codes machine-readable at the login boundary', async () => {
    fetchMock.mockResolvedValueOnce(
      apiErrorResponse(418, 'AUTH_GATE_ODDITY', 'The authentication gateway returned an unknown state.'),
    );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'doctor');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const errorBanner = await screen.findByTestId('login-error-banner');
    expect(errorBanner).toHaveAttribute('data-error-code', 'AUTH_GATE_ODDITY');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
  });
});
