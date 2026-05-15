import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiErrorResponse,
  authSuccessResponse,
  meSuccessResponse,
  renderApp,
  storeSession,
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

  it('replays bootstrap exactly once after refresh recovery and lands the protected shell', async () => {
    storeSession({
      accessToken: 'expired-token',
      role: 'admin',
      userId: 'user-1',
      username: 'admin',
    });

    fetchMock
      .mockResolvedValueOnce(
        apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.'),
      )
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'fresh-token',
          role: 'admin',
          userId: 'user-1',
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(
        meSuccessResponse({
          role: 'admin',
          userId: 'user-1',
          username: 'admin',
        }),
      );

    renderApp({ initialEntries: ['/app/admin'] });

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'admin');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/app/admin');

    const adminState = await screen.findByTestId('admin-overview-unavailable-state');
    expect(adminState).toHaveAttribute('data-screen-code', 'CONTRACT_PENDING');

    await waitFor(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('fresh-token');
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/v1/auth/me');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/auth/me');

    const initialHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const replayHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    expect(initialHeaders.get('Authorization')).toBe('Bearer expired-token');
    expect(replayHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('fails closed back to login when refresh recovery is rejected', async () => {
    storeSession({
      accessToken: 'expired-admin-token',
      role: 'admin',
      userId: 'user-1',
      username: 'admin',
    });

    fetchMock
      .mockResolvedValueOnce(
        apiErrorResponse(401, 'EXPIRED_ACCESS_TOKEN', 'Access token expired.'),
      )
      .mockResolvedValueOnce(
        apiErrorResponse(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.'),
      );

    renderApp({ initialEntries: ['/app/admin'] });

    const banner = await screen.findByTestId('refresh-required-banner');
    expect(banner).toBeInTheDocument();

    const loginPage = screen.getByTestId('login-page');
    expect(loginPage).toHaveAttribute('data-auth-status', 'refresh-failed');
    expect(loginPage).toHaveAttribute('data-session-notice', 'refresh-failed');
    expect(screen.getByTestId('router-location')).toHaveAttribute('data-pathname', '/login');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
