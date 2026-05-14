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

  it.each([
    {
      expectedPath: '/app/admin',
      role: 'admin' as const,
      screenCode: 'CONTRACT_PENDING',
      stateTestId: 'admin-overview-unavailable-state',
      username: 'admin',
    },
    {
      expectedPath: '/app/reception/scheduling',
      role: 'receptionist' as const,
      screenCode: 'CONTRACT_PENDING',
      stateTestId: 'reception-scheduling-unavailable-state',
      username: 'reception',
    },
    {
      expectedPath: '/app/doctor/queue',
      role: 'doctor' as const,
      screenCode: 'CONTRACT_PENDING',
      stateTestId: 'doctor-queue-unavailable-state',
      username: 'doctor',
    },
  ])('routes seeded $role login to the real home shell', async ({
    expectedPath,
    role,
    screenCode,
    stateTestId,
    username,
  }) => {
    fetchMock.mockResolvedValueOnce(
      authSuccessResponse({
        accessToken: `${role}-token`,
        role,
        username,
      }),
    );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), username);
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', role);
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    expect(shell).toHaveAttribute('data-session-notice', 'none');

    const location = screen.getByTestId('router-location');
    await waitFor(() => {
      expect(location).toHaveAttribute('data-pathname', expectedPath);
    });

    const state = await screen.findByTestId(stateTestId);
    expect(state).toHaveAttribute('data-screen-code', screenCode);
    expect(state).toHaveAttribute('data-screen-status', 'unavailable');
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
