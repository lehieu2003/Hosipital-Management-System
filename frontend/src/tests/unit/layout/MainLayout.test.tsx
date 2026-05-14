import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLayout } from '@/components/layout/MainLayout';
import { AuthContext, type AuthContextValue, type UserSession } from '@/features/auth';

const noopAsync = vi.fn().mockResolvedValue(undefined);

function buildAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const session: UserSession = {
    accessToken: 'access-token',
    role: 'admin',
    userId: 'user-1',
    username: 'alice',
  };

  return {
    session,
    authStatus: 'authenticated',
    login: vi.fn(),
    logout: noopAsync,
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderLayout(authValue: AuthContextValue, initialEntry = '/app/admin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route element={<MainLayout />} path="/app/admin">
            <Route element={<div>Admin content</div>} index />
          </Route>
          <Route element={<MainLayout />} path="/app/reception/scheduling">
            <Route element={<div>Scheduling content</div>} index />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('MainLayout', () => {
  it('surfaces role-aware shell metadata and navigation for admin users', () => {
    renderLayout(buildAuthValue());

    const shell = screen.getByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'admin');
    expect(shell).toHaveAttribute('data-auth-status', 'authenticated');

    const nav = screen.getByTestId('primary-navigation');
    expect(within(nav).getByRole('link', { name: 'Admin Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Scheduling' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Doctor Queue' })).toBeInTheDocument();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('hides admin navigation from receptionist users and surfaces refresh failure state', () => {
    renderLayout(
      buildAuthValue({
        authStatus: 'refresh-failed',
        session: {
          accessToken: 'access-token',
          role: 'receptionist',
          userId: 'user-2',
          username: 'riley',
        },
      }),
      '/app/reception/scheduling',
    );

    const shell = screen.getByTestId('app-shell');
    expect(shell).toHaveAttribute('data-role', 'receptionist');
    expect(screen.getByTestId('refresh-failed-banner')).toBeInTheDocument();

    const nav = screen.getByTestId('primary-navigation');
    expect(within(nav).queryByRole('link', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Scheduling' })).toBeInTheDocument();
  });
});
