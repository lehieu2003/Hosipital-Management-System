import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SchedulingPage } from '@/features/appointments/SchedulingPage';
import { AuthContext, type AuthContextValue, type UserSession } from '@/features/auth';

const noopAsync = vi.fn().mockResolvedValue(undefined);

function buildAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const session: UserSession = {
    accessToken: 'access-token',
    role: 'receptionist',
    userId: 'user-1',
    username: 'riley',
  };

  return {
    session,
    authStatus: 'authenticated',
    sessionNotice: null,
    sessionManager: {
      getSession: () => ({ accessToken: 'access-token' }),
      refreshSession: vi.fn().mockResolvedValue({ accessToken: 'fresh-token' }),
      onAuthFailure: vi.fn(),
    },
    login: vi.fn(),
    logout: noopAsync,
    refresh: vi.fn().mockResolvedValue({ ...session, accessToken: 'fresh-token' }),
    ...overrides,
  };
}

function renderSchedulingPage(authValue: AuthContextValue) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <SchedulingPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('scheduling page fail-closed boundary', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('surfaces an unavailable state when doctor discovery cannot be verified', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'OPD_UNAVAILABLE',
            message: 'Doctor directory unavailable.',
          },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderSchedulingPage(buildAuthValue());

    const state = await screen.findByTestId('reception-scheduling-unavailable-state');
    expect(state).toHaveAttribute('data-screen-status', 'unavailable');
    expect(state).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(screen.getByText(/directory-backed and never falls back to raw ids/i)).toBeInTheDocument();
  });
});
