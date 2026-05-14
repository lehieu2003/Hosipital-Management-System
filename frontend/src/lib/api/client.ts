import { appEnv } from '@/lib/config';

export type ApiErrorCode =
  | 'AUTH_EXPIRED'
  | 'REFRESH_FAILED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | string;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(message: string, status: number, code: ApiErrorCode, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export type SessionSnapshot = {
  accessToken: string;
};

export type SessionManager = {
  getSession: () => SessionSnapshot | null;
  refreshSession: () => Promise<SessionSnapshot | null>;
  onAuthFailure?: (error: ApiError) => void;
};

export type ApiClientOptions = {
  baseUrl?: string;
  sessionManager?: SessionManager;
};

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
  skipAuth?: boolean;
  replayAfterRefresh?: boolean;
};

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? appEnv.apiBaseUrl;
  const sessionManager = options.sessionManager;

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const response = await performFetch(path, requestOptions);

    if (!response.ok) {
      const apiError = await toApiError(response);

      if (
        !requestOptions.skipAuth &&
        requestOptions.replayAfterRefresh !== false &&
        shouldRefresh(apiError) &&
        sessionManager
      ) {
        const refreshed = await refreshOnce(sessionManager);
        if (refreshed) {
          return performRequest<T>(path, requestOptions, refreshed.accessToken);
        }
      }

      if (shouldNotifyAuthFailure(apiError)) {
        sessionManager?.onAuthFailure?.(apiError);
      }

      throw apiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async function performFetch(path: string, requestOptions: RequestOptions) {
    const session = requestOptions.skipAuth ? null : sessionManager?.getSession() ?? null;
    return performRawFetch(path, requestOptions, session?.accessToken ?? null);
  }

  async function performRequest<T>(
    path: string,
    requestOptions: RequestOptions,
    accessToken: string,
  ) {
    const response = await performRawFetch(path, requestOptions, accessToken);

    if (!response.ok) {
      const apiError = await toApiError(response);
      if (shouldNotifyAuthFailure(apiError)) {
        sessionManager?.onAuthFailure?.(apiError);
      }
      throw apiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async function performRawFetch(
    path: string,
    requestOptions: RequestOptions,
    accessToken: string | null,
  ) {
    const headers = new Headers(requestOptions.headers);

    if (requestOptions.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetch(buildUrl(baseUrl, path), {
      ...requestOptions,
      headers,
      credentials: 'include',
      body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
    });
  }

  return {
    request,
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
  };
}

async function refreshOnce(sessionManager: SessionManager) {
  try {
    return await sessionManager.refreshSession();
  } catch {
    return null;
  }
}

function shouldRefresh(error: ApiError) {
  return error.status === 401 && error.code === 'AUTH_EXPIRED';
}

function shouldNotifyAuthFailure(error: ApiError) {
  return error.code === 'AUTH_EXPIRED' || error.code === 'REFRESH_FAILED';
}

function buildUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function toApiError(response: Response) {
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

    const rawCode = payload.error?.code ?? 'UNKNOWN_ERROR';
    const mappedCode = mapErrorCode(response.status, rawCode);
    return new ApiError(
      payload.error?.message ?? fallback.message,
      response.status,
      mappedCode,
      response.status >= 500,
    );
  } catch {
    return mapStatusOnlyError(response.status);
  }
}

function mapErrorCode(status: number, rawCode: string): ApiErrorCode {
  if (status === 401 && rawCode === 'EXPIRED_ACCESS_TOKEN') {
    return 'AUTH_EXPIRED';
  }

  if (
    status === 401 &&
    [
      'INVALID_REFRESH_TOKEN',
      'EXPIRED_REFRESH_TOKEN',
      'REVOKED_REFRESH_TOKEN',
      'MISSING_REFRESH_TOKEN',
    ].includes(rawCode)
  ) {
    return 'REFRESH_FAILED';
  }

  if (status === 403) {
    return 'FORBIDDEN';
  }

  if (status === 409) {
    return 'CONFLICT';
  }

  if (status >= 500) {
    return 'UNAVAILABLE';
  }

  return rawCode;
}

function mapStatusOnlyError(status: number) {
  if (status === 401) {
    return new ApiError('Session expired', status, 'AUTH_EXPIRED');
  }

  if (status === 403) {
    return new ApiError('Access forbidden', status, 'FORBIDDEN');
  }

  if (status === 409) {
    return new ApiError('Conflict detected', status, 'CONFLICT');
  }

  if (status >= 500) {
    return new ApiError('Service unavailable', status, 'UNAVAILABLE', true);
  }

  return new ApiError(`Request failed with status ${status}`, status, 'UNKNOWN_ERROR');
}
