import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/features/auth';
import { STORAGE_KEY, type UserRole, type UserSession } from '@/lib/auth/session';

type RenderAppOptions = {
  initialEntries?: string[];
};

type SessionSeed = UserSession;

type AuthSuccessOptions = {
  accessToken?: string;
  role: UserRole;
  userId?: string;
  username: string;
};

function LocationProbe() {
  const location = useLocation();

  return <div data-pathname={location.pathname} data-testid="router-location" />;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

export function renderApp({ initialEntries = ['/'] }: RenderAppOptions = {}) {
  const queryClient = createTestQueryClient();

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <LocationProbe />
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

export function storeSession(overrides: Partial<SessionSeed> = {}) {
  const session: SessionSeed = {
    accessToken: 'seed-access-token',
    role: 'doctor',
    userId: 'user-1',
    username: 'doctor',
    ...overrides,
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function jsonResponse(body: unknown, init: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export function authSuccessResponse({
  accessToken = 'fresh-access-token',
  role,
  userId = 'user-1',
  username,
}: AuthSuccessOptions) {
  return jsonResponse(
    {
      success: true,
      data: {
        accessToken,
        user: {
          id: userId,
          username,
          role,
        },
      },
    },
    { status: 200 },
  );
}

export function meSuccessResponse({ role, userId = 'user-1', username }: Omit<AuthSuccessOptions, 'accessToken'>) {
  return jsonResponse(
    {
      success: true,
      data: {
        id: userId,
        username,
        role,
      },
    },
    { status: 200 },
  );
}

export function apiErrorResponse(status: number, code: string, message: string) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
