import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient, type SessionManager } from '@/api';

describe('createApiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends requests through the configured base url with auth and cookies', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      sessionManager: createSessionManager(),
    });

    const result = await client.get<{ ok: boolean }>('/healthz');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/healthz',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('refreshes once and replays the protected request when access is expired', async () => {
    const sessionManager = createSessionManager();
    sessionManager.refreshSession = vi.fn().mockResolvedValue({ accessToken: 'fresh-token' });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'EXPIRED_ACCESS_TOKEN',
              message: 'Access token expired',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'appt-1' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      sessionManager,
    });

    const result = await client.get<{ data: Array<{ id: string }> }>('/appointments');

    expect(result).toEqual({ data: [{ id: 'appt-1' }] });
    expect(sessionManager.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const initialHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const replayHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(initialHeaders.get('Authorization')).toBe('Bearer access-token');
    expect(replayHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('fails closed and notifies auth failure listeners when refresh is no longer valid', async () => {
    const onAuthFailure = vi.fn();
    const sessionManager = createSessionManager({ onAuthFailure });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      sessionManager,
    });

    await expect(client.get('/appointments')).rejects.toMatchObject({
      code: 'REFRESH_FAILED',
      status: 401,
    });
    expect(onAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'REFRESH_FAILED', status: 401 }),
    );
  });
});

function createSessionManager(overrides: Partial<SessionManager> = {}): SessionManager {
  return {
    getSession: () => ({ accessToken: 'access-token' }),
    refreshSession: vi.fn().mockResolvedValue(null),
    onAuthFailure: vi.fn(),
    ...overrides,
  };
}
