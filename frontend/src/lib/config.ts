const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

export type AppEnv = {
  apiBaseUrl: string;
};

export function readAppEnv(env: ImportMetaEnv = import.meta.env): AppEnv {
  return {
    apiBaseUrl: env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
  };
}

export const appEnv = readAppEnv();
