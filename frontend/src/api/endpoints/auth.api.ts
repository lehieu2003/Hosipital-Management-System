import { createApiClient, type SessionManager } from '@/api/client';
import { API_ENDPOINTS } from './api-endpoints';

export type LoginRequest = {
  password: string;
  username: string;
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

export function createAuthApi(sessionManager?: SessionManager) {
  const apiClient = createApiClient({ sessionManager });

  return {
    getCurrentUser: () => apiClient.get<MeSuccessEnvelope>(API_ENDPOINTS.auth.me),
    login: (payload: LoginRequest) =>
      apiClient.post<AuthSuccessEnvelope>(API_ENDPOINTS.auth.login, payload, { skipAuth: true }),
  };
}
