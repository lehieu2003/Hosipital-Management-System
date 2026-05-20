export function applyAuthHeader(headers: Headers, accessToken: string | null) {
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
}
