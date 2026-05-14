import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/features/auth';
import { STORAGE_KEY } from '@/lib/auth/session';

function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function storeSession(overrides: Partial<{ accessToken: string; role: string; userId: string; username: string }> = {}) {
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: 'expired-token',
      role: 'doctor',
      userId: 'user-1',
      username: 'doctor',
      ...overrides,
    }),
  );
}

describe('auth shell transitions', () => {
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

  it('replays bootstrap once after refresh and persists the fresh access token', async () => {
    storeSession();

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'EXPIRED_ACCESS_TOKEN',
              message: 'Access token expired',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'fresh-token',
              user: {
                id: 'user-1',
                username: 'doctor',
                role: 'doctor',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'user-1',
              username: 'doctor',
              role: 'doctor',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    renderApp(['/app/doctor/queue']);

    const shell = await screen.findByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'doctor');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');
    await screen.findByTestId('doctor-queue-unavailable-state');

    await waitFor(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('fresh-token');
    });
  });

  it('fails closed to the login boundary when refresh recovery is rejected', async () => {
    storeSession({ role: 'admin', username: 'admin' });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'EXPIRED_ACCESS_TOKEN',
              message: 'Access token expired',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'INVALID_REFRESH_TOKEN',
              message: 'Refresh token is invalid',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    renderApp(['/app/admin']);

    const banner = await screen.findByTestId('refresh-required-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toHaveAttribute('data-session-notice', 'refresh-failed');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
