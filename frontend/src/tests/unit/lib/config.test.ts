import { describe, expect, it } from 'vitest';

import { readAppEnv } from '@/lib/config';

describe('readAppEnv', () => {
  it('falls back to the local Node API base url when VITE_API_BASE_URL is unset', () => {
    expect(readAppEnv({} as ImportMetaEnv)).toEqual({
      apiBaseUrl: 'http://localhost:3000/api/v1',
    });
  });

  it('trims and uses the configured api base url when provided', () => {
    expect(
      readAppEnv({
        VITE_API_BASE_URL: '  https://stage.example.test/api/v1  ',
      } as ImportMetaEnv),
    ).toEqual({
      apiBaseUrl: 'https://stage.example.test/api/v1',
    });
  });
});
