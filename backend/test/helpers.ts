/**
 * Shared utilities for Vitest API integration tests.
 *
 * Constants, types, and helper functions used by all API test files.
 * Each test file imports from here and calls loginApitest() in beforeAll.
 *
 * With isolate: false, this module is cached across all test files in the suite.
 * The login result is cached so only ONE login request is made for the entire run.
 */
import { execSync } from 'node:child_process';

export const BASE_URL = 'http://localhost:3000/api/v2';
export const APITEST_EMAIL = 'admin@apitest.de';
export const APITEST_PASSWORD = 'ApiTest12345!';

/** Integration tests validate response shapes via assertions, not static types. */

export type JsonBody = Record<string, any>;

export interface AuthState {
  authToken: string;
  refreshToken: string;
  userId: number;
  tenantId: number;
}

// ─── Module-level cache (persists across all test files with isolate: false) ──

let _cachedAuth: AuthState | null = null;
let _authPromise: Promise<AuthState> | null = null;

/**
 * Login as apitest admin and return auth state.
 * Cached: only the first call makes a real HTTP request.
 * All subsequent calls (from other test files) return the cached result.
 */
export async function loginApitest(): Promise<AuthState> {
  if (_cachedAuth) return _cachedAuth;
  if (_authPromise) return _authPromise;

  _authPromise = _performLogin();
  return _authPromise;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function _performLogin(attempt = 1): Promise<AuthState> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: APITEST_EMAIL,
      password: APITEST_PASSWORD,
    }),
  });

  // Rate limited -- wait and retry
  if (res.status === 429 && attempt < MAX_RETRIES) {
    _authPromise = null;
    await new Promise((resolve) =>
      setTimeout(resolve, RETRY_DELAY_MS * attempt),
    );
    return _performLogin(attempt + 1);
  }

  if (!res.ok) {
    _authPromise = null;
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as JsonBody;
  _cachedAuth = {
    authToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    userId: body.data.user.id,
    tenantId: body.data.user.tenantId,
  };
  return _cachedAuth;
}

/**
 * Headers for authenticated requests WITH a JSON body (POST, PUT, PATCH).
 * Includes Content-Type: application/json.
 */
export function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Headers for authenticated requests WITHOUT a body (GET, DELETE, PUT-no-body).
 * Fastify rejects Content-Type: application/json when no body is present.
 */
export function authOnly(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch with 429 retry. Use for any endpoint that might be rate-limited.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

/**
 * Flush throttle/rate-limit keys from Redis.
 * Required for logs/export tests where ExportThrottle allows only 1 req/min.
 * Auth tokens are cached in-process (_cachedAuth), not in Redis -- safe to flush.
 */
export function flushThrottleKeys(): void {
  execSync(
    "docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning EVAL \"local keys = redis.call('KEYS', 'throttle:*') for i, key in ipairs(keys) do redis.call('DEL', key) end return #keys\" 0",
    { stdio: 'pipe' },
  );
}

/**
 * Create a test employee and return their ID.
 * Used by modules that need a second user (chat, etc.).
 */
export async function ensureTestEmployee(token: string): Promise<number> {
  // Try to create
  const createRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      email: 'employee@apitest.de',
      password: APITEST_PASSWORD,
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
      phone: '+49123456780',
    }),
  });

  if (createRes.status === 201) {
    const body = (await createRes.json()) as JsonBody;
    return body.data.id as number;
  }

  // Already exists -- find them in users list
  const listRes = await fetch(`${BASE_URL}/users?limit=10`, {
    headers: authOnly(token),
  });
  const listBody = (await listRes.json()) as JsonBody;
  const users = listBody.data as Array<{ id: number; email: string }>;
  const employee = users.find((u) => u.email === 'employee@apitest.de');

  if (!employee) {
    throw new Error('Test employee not found after create attempt');
  }

  return employee.id;
}

/**
 * Ensure the authenticated user has an E2E key registered.
 * Idempotent: checks GET /e2e/keys/me first, registers only if absent.
 * Returns { keyVersion } for use in encrypted message tests.
 */
export async function ensureE2eKey(
  token: string,
): Promise<{ keyVersion: number }> {
  // Check if key already exists
  const checkRes = await fetch(`${BASE_URL}/e2e/keys/me`, {
    headers: authOnly(token),
  });
  const checkBody = (await checkRes.json()) as JsonBody;

  if (checkBody.data !== null && checkBody.data !== undefined) {
    return { keyVersion: checkBody.data.keyVersion as number };
  }

  // Register a deterministic 32-byte X25519 test key (all zeros, base64)
  const testPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const registerRes = await fetch(`${BASE_URL}/e2e/keys`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ publicKey: testPublicKey }),
  });

  if (registerRes.status === 409) {
    // Race condition: another process registered between check and register
    const refetchRes = await fetch(`${BASE_URL}/e2e/keys/me`, {
      headers: authOnly(token),
    });
    const refetchBody = (await refetchRes.json()) as JsonBody;
    return { keyVersion: (refetchBody.data?.keyVersion as number) ?? 1 };
  }

  if (!registerRes.ok) {
    throw new Error(
      `E2E key registration failed: ${registerRes.status} ${registerRes.statusText}`,
    );
  }

  const registerBody = (await registerRes.json()) as JsonBody;
  return { keyVersion: registerBody.data.keyVersion as number };
}
