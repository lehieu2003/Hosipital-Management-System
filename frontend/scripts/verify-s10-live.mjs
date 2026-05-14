#!/usr/bin/env node

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;
const SESSION_STORAGE_KEY = 'hms.frontend.session';

const frontendUrl = normalizeUrl(process.env.S10_FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL);
const apiBaseUrl = normalizeUrl(process.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL);
const timeoutMs = Number(process.env.S10_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

async function main() {
  assertTimeout(timeoutMs);

  logSection('S10 live localhost verifier');
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(`API base URL: ${apiBaseUrl}`);
  console.log(
    process.env.VITE_API_BASE_URL?.trim()
      ? 'Frontend API base comes from VITE_API_BASE_URL.'
      : `VITE_API_BASE_URL is unset; the frontend will fall back to ${DEFAULT_API_BASE_URL}.`,
  );
  console.log('This verifier never prints access tokens or refresh cookies.');

  await waitForJsonEndpoint({
    description: 'backend health endpoint',
    expect: expectHealthPayload,
    path: '/healthz',
  });

  await waitForHtmlPage({
    description: 'frontend landing page',
    path: '/',
  });

  await waitForHtmlPage({
    description: 'frontend login page',
    path: '/login',
  });

  await verifyAuthContract();
  printBrowserChecklist();
}

async function verifyAuthContract() {
  logSection('Auth contract preflight');

  const invalidLogin = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username: 'doctor', password: 'wrong-password' }),
  });

  assertStatus(invalidLogin.response.status, 401, 'Expected invalid login to fail with 401.');
  assertErrorCode(invalidLogin.payload, 'INVALID_CREDENTIALS', '/auth/login invalid-credential path');
  console.log('✓ /auth/login rejects invalid credentials with INVALID_CREDENTIALS.');

  const login = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username: 'doctor', password: 'secret123' }),
  });

  assertStatus(login.response.status, 200, 'Expected seeded doctor login to succeed.');
  assertSuccessEnvelope(login.payload, '/auth/login success path');
  assertEqual(login.payload.data.user.username, 'doctor', 'Seeded doctor login returned the wrong username.');
  assertEqual(login.payload.data.user.role, 'DOCTOR', 'Seeded doctor login returned the wrong role.');
  const refreshCookie = getFirstSetCookie(login.response);
  console.log('✓ /auth/login accepts seeded doctor credentials and issues a refresh cookie.');

  const me = await fetchJson(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${login.payload.data.accessToken}`,
    },
  });

  assertStatus(me.response.status, 200, 'Expected /auth/me to succeed with the issued bearer token.');
  assertSuccessEnvelope(me.payload, '/auth/me success path');
  assertEqual(me.payload.data.username, 'doctor', '/auth/me returned the wrong username.');
  console.log('✓ /auth/me resolves the seeded doctor identity with the issued access token.');

  const refresh = await fetchJson(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: refreshCookie,
    },
  });

  assertStatus(refresh.response.status, 200, 'Expected /auth/refresh to rotate the seeded doctor session.');
  assertSuccessEnvelope(refresh.payload, '/auth/refresh success path');
  const rotatedCookie = getFirstSetCookie(refresh.response);
  if (rotatedCookie === refreshCookie) {
    throw new Error('/auth/refresh did not rotate the refresh cookie.');
  }
  console.log('✓ /auth/refresh rotates the seeded doctor refresh session.');

  const replay = await fetchJson(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: refreshCookie,
    },
  });

  assertStatus(replay.response.status, 401, 'Expected replayed refresh cookie to fail with 401.');
  assertErrorCode(replay.payload, 'REVOKED_REFRESH_TOKEN', '/auth/refresh replay path');
  console.log('✓ /auth/refresh rejects the replayed cookie with REVOKED_REFRESH_TOKEN.');
}

function printBrowserChecklist() {
  logSection('Browser rerun checklist');

  const lines = [
    '0. Start with a fresh browser session or clear storage/cookies before each role run to avoid stale auth state.',
    `   - Session storage key: ${SESSION_STORAGE_KEY}`,
    `1. Open ${frontendUrl}/login and confirm [data-testid="login-page"] is present.`,
    '   - Confirm the page advertises the seeded backend accounts: admin / reception / doctor with password secret123.',
    '2. Sign in as admin / secret123.',
    '   - Expect to land on /app/admin.',
    '   - Expect [data-testid="app-shell"][data-role="admin"][data-auth-status="authenticated"].',
    '   - Expect [data-testid="admin-overview-unavailable-state"][data-screen-code="CONTRACT_PENDING"][data-screen-status="unavailable"].',
    '3. Sign out, then sign in as reception / secret123.',
    '   - Expect to land on /app/reception/scheduling.',
    '   - Expect [data-testid="app-shell"][data-role="receptionist"].',
    '   - Expect [data-testid="reception-scheduling-unavailable-state"][data-screen-code="CONTRACT_PENDING"].',
    `   - Directly open ${frontendUrl}/app/admin and expect [data-testid="route-forbidden-state"] while the shell still reports data-role="receptionist".`,
    '4. Sign out, then sign in as doctor / secret123.',
    '   - Expect to land on /app/doctor/queue.',
    '   - Expect [data-testid="app-shell"][data-role="doctor"].',
    '   - Expect [data-testid="doctor-queue-unavailable-state"][data-screen-code="CONTRACT_PENDING"].',
    '5. Prove refresh-failure logout without fake adapters.',
    '   - Sign out to clear the real refresh cookie.',
    `   - On ${frontendUrl}/login, set sessionStorage["${SESSION_STORAGE_KEY}"] to JSON.stringify({ accessToken: "expired-admin-token", userId: "user-1", username: "admin", role: "admin" }).`,
    `   - Open ${frontendUrl}/app/admin.`,
    '   - Expect a bounded redirect back to /login with [data-testid="refresh-required-banner"] and login-page data-auth-status="refresh-failed".',
    '6. Treat any ready/real operational admin, scheduling, or queue data as a failure for S10.',
    '   - This slice proves auth/RBAC shells against the live Node auth backend only.',
    '   - Full R010 operational closure still depends on live Node admin, scheduling, and queue contracts.',
  ];

  for (const line of lines) {
    console.log(line);
  }
}

async function waitForJsonEndpoint({ description, expect, path }) {
  logSection(`Polling ${description}`);
  await poll(
    async () => {
      const { response, payload } = await fetchJson(`${apiBaseUrl}${path}`, { method: 'GET' });
      assertStatus(response.status, 200, `${description} returned ${response.status} instead of 200.`);
      expect(payload, description);
      return payload;
    },
    `${description} at ${apiBaseUrl}${path}`,
  );
  console.log(`✓ ${description} is reachable.`);
}

async function waitForHtmlPage({ description, path }) {
  logSection(`Polling ${description}`);
  await poll(
    async () => {
      const response = await fetch(`${frontendUrl}${path}`, { redirect: 'follow' });
      assertStatus(response.status, 200, `${description} returned ${response.status} instead of 200.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`${description} returned unexpected content-type: ${contentType || 'missing'}.`);
      }

      const html = await response.text();
      if (!html.includes('<div id="root"></div>')) {
        throw new Error(`${description} did not render the expected Vite root shell.`);
      }

      return html;
    },
    `${description} at ${frontendUrl}${path}`,
  );
  console.log(`✓ ${description} is reachable.`);
}

async function poll(operation, description) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}. Last error: ${reason}`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const bodyText = await response.text();

  try {
    const payload = JSON.parse(bodyText);
    return { response, payload };
  } catch {
    const snippet = bodyText.slice(0, 240).replace(/\s+/g, ' ').trim();
    throw new Error(`Expected JSON from ${url} but received: ${snippet || '<empty body>'}`);
  }
}

function expectHealthPayload(payload, description) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${description} returned a non-object JSON payload.`);
  }

  if (payload.success !== true) {
    throw new Error(`${description} did not return success=true.`);
  }

  if (payload.data?.status !== 'ok' || payload.data?.ready !== true) {
    throw new Error(`${description} returned an unexpected readiness payload.`);
  }
}

function assertSuccessEnvelope(payload, label) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${label} returned a non-object JSON payload.`);
  }

  if (payload.success !== true || !payload.data) {
    throw new Error(`${label} did not return a success envelope.`);
  }
}

function assertErrorCode(payload, expectedCode, label) {
  const actualCode = payload?.error?.code;
  if (actualCode !== expectedCode) {
    throw new Error(`${label} returned error code ${String(actualCode)} instead of ${expectedCode}.`);
  }
}

function getFirstSetCookie(response) {
  const cookieHeader = response.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Expected a Set-Cookie header but none was returned.');
  }

  return cookieHeader.split(',')[0].trim();
}

function assertStatus(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Received ${String(actual)}.`);
  }
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

function assertTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`S10_VERIFY_TIMEOUT_MS must be a positive number, received ${String(value)}.`);
  }
}

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`\nS10 live verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
