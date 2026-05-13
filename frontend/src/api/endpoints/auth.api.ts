import { createApiClient } from '@/api';

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

const apiClient = createApiClient();

export const authApi = {
  getCurrentUser: () => apiClient.get<MeSuccessEnvelope>('/auth/me'),
  login: (payload: LoginRequest) => apiClient.post<AuthSuccessEnvelope>('/auth/login', payload),
};
