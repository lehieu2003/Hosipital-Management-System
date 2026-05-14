import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { ApiError, type ApiErrorCode } from '@/lib/api/client';
import { appEnv } from '@/lib/config';
import {
  AuthContext,
  normalizeRole,
  persistSession,
  readStoredSession,
  toUserSession,
  type AuthStatus,
  type AuthSuccessEnvelope,
  type MeSuccessEnvelope,
  type UserSession,
} from '@/lib/auth/session';

function isRefreshFailureCode(code: ApiErrorCode) {
  return code === 'REFRESH_FAILED' || code === 'AUTH_EXPIRED';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<UserSession | null>(() => readStoredSession());
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    readStoredSession() ? 'authenticated' : 'anonymous',
  );
  const refreshPromiseRef = useRef<Promise<UserSession | null> | null>(null);

  const clearSession = useCallback(() => {
    setSession(null);
    persistSession(null);
  }, []);

  const applySession = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const refresh = useCallback(async (): Promise<UserSession | null> => {
    if (!refreshPromiseRef.current) {
      setAuthStatus((current) =>
        current === 'authenticated' || current === 'booting' ? 'refreshing' : current,
      );

      refreshPromiseRef.current = (async () => {
        try {
          const response = await window.fetch(`${appEnv.apiBaseUrl}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!response.ok) {
            const error = await toApiErrorFromResponse(response);
            if (isRefreshFailureCode(error.code)) {
              clearSession();
              setAuthStatus('refresh-failed');
              return null;
            }

            throw error;
          }

          const payload = (await response.json()) as AuthSuccessEnvelope;
          const nextSession = toUserSession(payload.data);
          applySession(nextSession);
          setAuthStatus('authenticated');
          return nextSession;
        } catch (error) {
          if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
            clearSession();
            setAuthStatus('refresh-failed');
            return null;
          }

          clearSession();
          setAuthStatus('refresh-failed');
          return null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();
    }

    return refreshPromiseRef.current;
  }, [applySession, clearSession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await window.fetch(`${appEnv.apiBaseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw await toApiErrorFromResponse(response);
      }

      const payload = (await response.json()) as AuthSuccessEnvelope;
      const nextSession = toUserSession(payload.data);
      applySession(nextSession);
      setAuthStatus('authenticated');
      return nextSession;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await window.fetch(`${appEnv.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearSession();
      setAuthStatus('anonymous');
    }
  }, [clearSession]);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    let cancelled = false;
    const currentAccessToken = session.accessToken;

    const requestWithAuth = async <T,>(
      path: string,
      init: RequestInit & { replayAfterRefresh?: boolean } = {},
    ): Promise<T> => {
      const execute = async (accessToken: string | null) => {
        const headers = new Headers(init.headers);

        if (accessToken && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${accessToken}`);
        }

        const response = await window.fetch(`${appEnv.apiBaseUrl}${path}`, {
          ...init,
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          throw await toApiErrorFromResponse(response);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      };

      try {
        return await execute(currentAccessToken);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === 'AUTH_EXPIRED' &&
          init.replayAfterRefresh !== false
        ) {
          const nextSession = await refresh();
          if (nextSession) {
            return execute(nextSession.accessToken);
          }
        }

        if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
          clearSession();
          setAuthStatus('refresh-failed');
        }

        throw error;
      }
    };

    const bootstrap = async () => {
      setAuthStatus('booting');

      try {
        const payload = await requestWithAuth<MeSuccessEnvelope>('/auth/me', {
          method: 'GET',
          replayAfterRefresh: true,
        });

        if (cancelled) {
          return;
        }

        const hydratedSession: UserSession = {
          accessToken: currentAccessToken,
          userId: payload.data.id,
          username: payload.data.username,
          role: normalizeRole(payload.data.role),
        };

        applySession(hydratedSession);
        setAuthStatus('authenticated');
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
          clearSession();
          setAuthStatus('refresh-failed');
          return;
        }

        clearSession();
        setAuthStatus('anonymous');
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession, refresh, session?.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        session,
        authStatus,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

async function toApiErrorFromResponse(response: Response) {
  const fallback = new ApiError(
    `Request failed with status ${response.status}`,
    response.status,
    'UNKNOWN_ERROR',
  );

  try {
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    const code = payload.error?.code ?? 'UNKNOWN_ERROR';
    if (
      [
        'MISSING_REFRESH_TOKEN',
        'INVALID_REFRESH_TOKEN',
        'EXPIRED_REFRESH_TOKEN',
        'REVOKED_REFRESH_TOKEN',
      ].includes(code)
    ) {
      return new ApiError(
        payload.error?.message ?? 'Refresh failed',
        response.status,
        'REFRESH_FAILED',
      );
    }

    if (code === 'EXPIRED_ACCESS_TOKEN') {
      return new ApiError(
        payload.error?.message ?? 'Session expired',
        response.status,
        'AUTH_EXPIRED',
      );
    }

    if (response.status === 403) {
      return new ApiError(
        payload.error?.message ?? 'Access forbidden',
        response.status,
        'FORBIDDEN',
      );
    }

    if (response.status === 409) {
      return new ApiError(
        payload.error?.message ?? 'Conflict detected',
        response.status,
        'CONFLICT',
      );
    }

    if (response.status >= 500) {
      return new ApiError(
        payload.error?.message ?? 'Service unavailable',
        response.status,
        'UNAVAILABLE',
        true,
      );
    }

    return new ApiError(payload.error?.message ?? fallback.message, response.status, code);
  } catch {
    return fallback;
  }
}
