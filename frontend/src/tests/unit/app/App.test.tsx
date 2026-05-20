import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/features/auth';
import { STORAGE_KEY } from '@/lib/auth/session';

function renderApp(initialEntries: string[] = ['/']) {
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

describe('App scaffold', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('should render the landing page for anonymous users on the home route', () => {
    renderApp(['/']);

    expect(
      screen.getByRole('heading', {
        name: 'From registration to queue flow, in one calm clinical workspace.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0);
  });

  it('should render workspace links for authenticated users on the home route', () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'access-token',
        role: 'doctor',
        userId: 'user-1',
        username: 'doctor',
      }),
    );

    renderApp(['/']);

    const workspaceLinks = screen.getAllByRole('link', { name: /open workspace/i });
    expect(workspaceLinks.length).toBeGreaterThan(0);
    expect(workspaceLinks.every((link) => link.getAttribute('href') === '/app/doctor/queue')).toBe(
      true,
    );
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('should render the login shell on the login route', () => {
    renderApp(['/login']);

    expect(
      screen.getByRole('heading', { name: 'Hospital operations, without ambiguous access.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should redirect anonymous users from protected app routes to login', () => {
    renderApp(['/app/admin']);

    expect(
      screen.getByRole('heading', { name: 'Hospital operations, without ambiguous access.' }),
    ).toBeInTheDocument();
  });
});
