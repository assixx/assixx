/**
 * Auth helpers for k6 load tests.
 *
 * Mirrors `backend/test/helpers.ts` shape: login against apitest tenant,
 * expose authHeaders/authOnly split (Fastify rejects Content-Type on
 * body-less requests, see ADR-018 / HOW-TO-TEST).
 *
 * Difference vs. Vitest helpers: k6's `http.post()` is synchronous (runs
 * in the goja VM, not Node). `setup()` executes once before VUs start —
 * return value is passed to `default()`, so every VU reuses the same token
 * (no per-iteration login, avoids throttle pressure).
 */
import { check, fail } from 'k6';
import http from 'k6/http';

import { APITEST_EMAIL, APITEST_PASSWORD, BASE_URL } from './config.ts';

export interface AuthState {
  authToken: string;
  refreshToken: string;
  userId: number;
  tenantId: number;
}

/**
 * Login as apitest admin. Call from `setup()` — once per test run.
 * Fails loud (aborts test) on non-200 to surface config issues immediately
 * rather than cascading into 401s on every subsequent request.
 */
export function loginApitest(): AuthState {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: APITEST_EMAIL, password: APITEST_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login' },
    },
  );

  const ok = check(res, {
    'login returns 200': (r) => r.status === 200,
  });
  if (!ok) {
    fail(`Login failed: status=${res.status} body=${res.body as string}`);
  }

  const body = res.json() as {
    data: {
      accessToken: string;
      refreshToken: string;
      user: { id: number; tenantId: number };
    };
  };

  return {
    authToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    userId: body.data.user.id,
    tenantId: body.data.user.tenantId,
  };
}

/** Headers for POST/PUT/PATCH with JSON body. */
export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Headers for GET/DELETE (no body). Fastify 5 rejects Content-Type on
 * body-less requests with 400 Bad Request — see ADR-018 Special Cases.
 */
export function authOnly(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}
