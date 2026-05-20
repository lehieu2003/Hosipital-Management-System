import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { API_ENDPOINTS, ApiError, type ApiErrorCode, type SessionManager } from '@/api';
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
  type SessionNotice,
  type UserSession,
} from '@/lib/auth/session';

function isRefreshFailureCode(code: ApiErrorCode) {
  return code === 'REFRESH_FAILED' || code === 'AUTH_EXPIRED';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<UserSession | null>(() => readStoredSession());
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    readStoredSession() ? 'booting' : 'anonymous',
  );
  const [sessionNotice, setSessionNotice] = useState<SessionNotice>(() =>
    readStoredSession() ? null : 'signed-out',
  );
  const refreshPromiseRef = useRef<Promise<UserSession | null> | null>(null);
  const validatedAccessTokenRef = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    validatedAccessTokenRef.current = null;
    setSession(null);
    persistSession(null);
  }, []);

  const applySession = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const failClosed = useCallback(
    (notice: Exclude<SessionNotice, null>) => {
      clearSession();
      setSessionNotice(notice);
      setAuthStatus(notice === 'refresh-failed' ? 'refresh-failed' : 'anonymous');
    },
    [clearSession],
  );

  const handleAuthFailure = useCallback(
    (error: ApiError) => {
      if (error.code === 'REFRESH_FAILED') {
        failClosed('refresh-failed');
        return;
      }

      if (error.code === 'AUTH_EXPIRED') {
        setSessionNotice('expired');
        setAuthStatus((current) =>
          current === 'authenticated' || current === 'booting' ? 'refreshing' : current,
        );
      }
    },
    [failClosed],
  );

  const refresh = useCallback(async (options: { commitSession?: boolean } = {}): Promise<UserSession | null> => {
    const commitSession = options.commitSession ?? true;

    if (!refreshPromiseRef.current) {
      setSessionNotice('expired');
      setAuthStatus((current) =>
        current === 'authenticated' || current === 'booting' ? 'refreshing' : current,
      );

      refreshPromiseRef.current = (async () => {
        try {
          const response = await window.fetch(`${appEnv.apiBaseUrl}${API_ENDPOINTS.auth.refresh}`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!response.ok) {
            const error = await toApiErrorFromResponse(response);
            if (isRefreshFailureCode(error.code)) {
              failClosed('refresh-failed');
              return null;
            }

            throw error;
          }

          const payload = (await response.json()) as AuthSuccessEnvelope;
          const nextSession = toUserSession(payload.data);

          if (commitSession) {
            validatedAccessTokenRef.current = nextSession.accessToken;
            applySession(nextSession);
            setSessionNotice(null);
            setAuthStatus('authenticated');
          }

          return nextSession;
        } catch (error) {
          if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
            failClosed('refresh-failed');
            return null;
          }

          failClosed('refresh-failed');
          return null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();
    }

    return refreshPromiseRef.current;
  }, [applySession, failClosed]);

  const login = useCallback(
    async (username: string, password: string) => {
      setSessionNotice(null);
      setAuthStatus('authenticating');

      const response = await window.fetch(`${appEnv.apiBaseUrl}${API_ENDPOINTS.auth.login}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setAuthStatus('anonymous');
        throw await toApiErrorFromResponse(response);
      }

      const payload = (await response.json()) as AuthSuccessEnvelope;
      const nextSession = toUserSession(payload.data);
      validatedAccessTokenRef.current = nextSession.accessToken;
      applySession(nextSession);
      setSessionNotice(null);
      setAuthStatus('authenticated');
      return nextSession;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await window.fetch(`${appEnv.apiBaseUrl}${API_ENDPOINTS.auth.logout}`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearSession();
      setSessionNotice('signed-out');
      setAuthStatus('anonymous');
    }
  }, [clearSession]);

  const sessionManager = useMemo<SessionManager>(
    () => ({
      getSession: () => (session ? { accessToken: session.accessToken } : null),
      refreshSession: refresh,
      onAuthFailure: handleAuthFailure,
    }),
    [handleAuthFailure, refresh, session],
  );

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    if (validatedAccessTokenRef.current === session.accessToken) {
      return;
    }

    let cancelled = false;
    const currentAccessToken = session.accessToken;

    const executeRequest = async <T,>(path: string, init: RequestInit, accessToken: string) => {
      const headers = new Headers(init.headers);

      if (!headers.has('Authorization')) {
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
        return { accessToken, data: undefined as T };
      }

      return {
        accessToken,
        data: (await response.json()) as T,
      };
    };

    const requestWithAuth = async <T,>(
      path: string,
      init: RequestInit & { replayAfterRefresh?: boolean } = {},
    ) => {
      try {
        return await executeRequest<T>(path, init, currentAccessToken);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === 'AUTH_EXPIRED' &&
          init.replayAfterRefresh !== false
        ) {
          setSessionNotice('expired');
          const nextSession = await refresh({ commitSession: false });
          if (nextSession) {
            return executeRequest<T>(path, init, nextSession.accessToken);
          }
        }

        if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
          failClosed('refresh-failed');
        }

        throw error;
      }
    };

    const bootstrap = async () => {
      setAuthStatus('booting');

      try {
        const payload = await requestWithAuth<MeSuccessEnvelope>(API_ENDPOINTS.auth.me, {
          method: 'GET',
          replayAfterRefresh: true,
        });

        if (cancelled) {
          return;
        }

        const currentUser = payload.data.data;
        const hydratedSession: UserSession = {
          accessToken: payload.accessToken,
          userId: currentUser.id,
          username: currentUser.username,
          role: normalizeRole(currentUser.role),
        };

        validatedAccessTokenRef.current = hydratedSession.accessToken;
        applySession(hydratedSession);
        setSessionNotice(null);
        setAuthStatus('authenticated');
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && isRefreshFailureCode(error.code)) {
          failClosed('refresh-failed');
          return;
        }

        failClosed('signed-out');
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applySession, failClosed, refresh, session?.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        session,
        authStatus,
        sessionNotice,
        sessionManager,
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
