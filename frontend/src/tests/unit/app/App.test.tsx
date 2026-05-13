import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/features/auth';

function renderApp(initialEntries: string[] = ['/login']) {
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

  it('should render the login shell for anonymous users', () => {
    renderApp(['/login']);

    expect(
      screen.getByRole('heading', { name: 'Hospital Management UI runtime' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('should redirect anonymous users from the home route to login', () => {
    renderApp(['/']);

    expect(
      screen.getByRole('heading', { name: 'Hospital Management UI runtime' }),
    ).toBeInTheDocument();
  });
});
