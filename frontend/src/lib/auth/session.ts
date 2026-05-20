import { createContext, useContext } from 'react';

import type { SessionManager, SessionSnapshot } from '@/api';

export type UserRole = 'admin' | 'doctor' | 'receptionist';

export type AuthStatus =
  | 'booting'
  | 'authenticating'
  | 'authenticated'
  | 'anonymous'
  | 'refreshing'
  | 'refresh-failed';

export type SessionNotice = 'signed-out' | 'expired' | 'refresh-failed' | null;

export type UserSession = SessionSnapshot & {
  userId: string;
  username: string;
  role: UserRole;
};

export type AuthContextValue = {
  session: UserSession | null;
  authStatus: AuthStatus;
  sessionNotice: SessionNotice;
  sessionManager: SessionManager;
  login: (username: string, password: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  refresh: (options?: {
    commitSession?: boolean;
  }) => Promise<UserSession | null>;
};

export type AuthSuccessEnvelope = {
  success: true;
  data: {
    accessToken: string;
    user: {
      id: string;
      username: string;
      role: string;
    };
  };
};

export type MeSuccessEnvelope = {
  success: true;
  data: {
    id: string;
    username: string;
    role: string;
  };
};

export const STORAGE_KEY = 'hms.frontend.session';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function readStoredSession(): UserSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.username !== 'string' ||
      !isUserRole(parsed.role)
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      userId: parsed.userId,
      username: parsed.username,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function persistSession(session: UserSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();

  if (
    normalized === 'doctor' ||
    normalized === 'receptionist' ||
    normalized === 'admin'
  ) {
    return normalized;
  }

  throw new Error(`Unsupported role received from API: ${role}`);
}

export function isUserRole(role: unknown): role is UserRole {
  return role === 'admin' || role === 'doctor' || role === 'receptionist';
}

export function toUserSession(
  payload: AuthSuccessEnvelope['data'],
): UserSession {
  return {
    accessToken: payload.accessToken,
    userId: payload.user.id,
    username: payload.user.username,
    role: normalizeRole(payload.user.role),
  };
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
