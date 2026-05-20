import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiErrorResponse,
  authSuccessResponse,
  meSuccessResponse,
  renderApp,
} from '@/tests/test-utils/render-app';
import { STORAGE_KEY } from '@/lib/auth/session';

describe('auth fail-closed boundary integration', () => {
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

  it('replays auth bootstrap exactly once after refresh recovery before loading the live doctor queue shell', async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expired-doctor-token',
        role: 'doctor',
        userId: 'user-1',
        username: 'doctor',
      }),
    );

    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const authorization = headers.get('Authorization');

      if (url === 'http://localhost:3000/api/v1/auth/refresh') {
        refreshCalls += 1;
        return authSuccessResponse({
          accessToken: 'fresh-doctor-token',
          role: 'doctor',
          userId: 'user-1',
          username: 'doctor',
        });
      }

      if (url === 'http://localhost:3000/api/v1/auth/me') {
        if (authorization === 'Bearer expired-doctor-token') {
          return apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.');
        }

        if (authorization === 'Bearer fresh-doctor-token') {
          return meSuccessResponse({
            role: 'doctor',
            userId: 'user-1',
            username: 'doctor',
          });
        }
      }

      if (url === 'http://localhost:3000/api/v1/doctor/queue') {
        if (authorization === 'Bearer expired-doctor-token') {
          return apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.');
        }

        if (authorization === 'Bearer fresh-doctor-token') {
          return new Response(
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
          );
        }
      }

      throw new Error(`Unexpected fetch ${url} with Authorization ${authorization ?? '<none>'}.`);
    });

    renderApp({ initialEntries: ['/app/doctor/queue'] });

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'doctor');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/app/doctor/queue');

    const queueItem = await screen.findByTestId('doctor-queue-item-appointment-1');
    expect(queueItem).toHaveAttribute('data-appointment-status', 'SCHEDULED');
    expect(screen.getByTestId('doctor-queue-action-ready-state')).toHaveAttribute('data-screen-code', 'READY');

    await waitFor(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('fresh-doctor-token');
    });

    expect(refreshCalls).toBe(1);

    const authMeCalls = fetchMock.mock.calls.filter(
      ([url]) => url === 'http://localhost:3000/api/v1/auth/me',
    );
    const queueCalls = fetchMock.mock.calls.filter(
      ([url]) => url === 'http://localhost:3000/api/v1/doctor/queue',
    );
    const refreshCallsByUrl = fetchMock.mock.calls.filter(
      ([url]) => url === 'http://localhost:3000/api/v1/auth/refresh',
    );

    expect(authMeCalls.length).toBeGreaterThanOrEqual(2);
    expect(queueCalls.length).toBeGreaterThanOrEqual(1);
    expect(refreshCallsByUrl).toHaveLength(1);

    const authMeAuthorizations = authMeCalls.map(([, init]) => new Headers(init?.headers).get('Authorization'));
    const queueAuthorizations = queueCalls.map(([, init]) => new Headers(init?.headers).get('Authorization'));

    expect(authMeAuthorizations).toContain('Bearer expired-doctor-token');
    expect(authMeAuthorizations).toContain('Bearer fresh-doctor-token');
    expect(queueAuthorizations).toContain('Bearer fresh-doctor-token');
    expect(queueAuthorizations).not.toContain('Bearer expired-doctor-token');
  });

  it('fails closed back to login when refresh recovery is rejected without loading the doctor queue', async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expired-doctor-token',
        role: 'doctor',
        userId: 'user-1',
        username: 'doctor',
      }),
    );

    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const authorization = headers.get('Authorization');

      if (url === 'http://localhost:3000/api/v1/auth/refresh') {
        refreshCalls += 1;
        return apiErrorResponse(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
      }

      if (url === 'http://localhost:3000/api/v1/auth/me' && authorization === 'Bearer expired-doctor-token') {
        return apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.');
      }

      throw new Error(`Unexpected fetch ${url} with Authorization ${authorization ?? '<none>'}.`);
    });

    renderApp({ initialEntries: ['/app/doctor/queue'] });

    const banner = await screen.findByTestId('refresh-required-banner');
    expect(banner).toBeInTheDocument();

    const loginPage = screen.getByTestId('login-page');
    expect(loginPage).toHaveAttribute('data-auth-status', 'refresh-failed');
    expect(loginPage).toHaveAttribute('data-session-notice', 'refresh-failed');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    expect(refreshCalls).toBe(1);

    const queueCalls = fetchMock.mock.calls.filter(
      ([url]) => url === 'http://localhost:3000/api/v1/doctor/queue',
    );
    expect(queueCalls).toHaveLength(0);
  });

  it('treats malformed persisted auth bootstrap state as anonymous and avoids protected fetches', async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken: 123, role: 'doctor', userId: 'user-1', username: 'doctor' }),
    );

    renderApp({ initialEntries: ['/app/doctor/queue'] });

    const loginPage = await screen.findByTestId('login-page');
    expect(loginPage).toHaveAttribute('data-auth-status', 'anonymous');
    expect(loginPage).toHaveAttribute('data-session-notice', 'signed-out');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
