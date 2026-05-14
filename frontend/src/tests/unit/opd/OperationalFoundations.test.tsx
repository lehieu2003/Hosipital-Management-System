import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('operational foundations', () => {
  it('surfaces a fail-closed unavailable state instead of fake scheduling data when no contract is wired', async () => {
    renderSchedulingPage(buildAuthValue());

    const state = await screen.findByTestId('reception-scheduling-unavailable-state');
    expect(state).toHaveAttribute('data-screen-status', 'unavailable');
    expect(state).toHaveAttribute('data-screen-code', 'CONTRACT_PENDING');
    expect(screen.getByText(/no placeholder operational metrics/i)).toBeInTheDocument();
  });
});
