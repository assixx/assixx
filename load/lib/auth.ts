/**
 * Auth helpers for k6 load tests.
 *
 * Mirrors `backend/test/helpers.ts` shape: login against assixx test tenant,
 * expose authHeaders/authOnly split (Fastify rejects Content-Type on
 * body-less requests, see ADR-018 / HOW-TO-TEST).
 *
 * Difference vs. Vitest helpers: k6's `http.post()` is synchronous (runs
 * in the goja VM, not Node). `setup()` executes once before VUs start —
 * return value is passed to `default()`, so every VU reuses the same token
 * (no per-iteration login, avoids throttle pressure).
 *
 * Mandatory Email-2FA contract (ADR-054, FEAT_2FA_EMAIL_MASTERPLAN R13 +
 * DD-10 Removal v0.5.0): `POST /auth/login` now returns the discriminated
 * union `LoginResultBody`. With DD-10 removed (no flag, 2FA hard-coded), a
 * password login from this rig ALWAYS resolves to `stage === 'challenge_required'`.
 *
 * Resolution (v0.8.16 — Phase 7 follow-up to R13): the `challenge_required`
 * branch is completed via `completeChallengeViaMailpit` (`./2fa-helper.ts`)
 * which polls Mailpit for the freshly-issued code mail, extracts the 6-char
 * code from the plain-text body, and submits to `/auth/2fa/verify`. Same
 * `AuthState` shape returned, so `smoke.ts` + `baseline.ts` callers stay
 * unchanged. Validates the SMTP pipeline as a side-effect — a broken
 * `send2faCode` path manifests as a 15 s setup-time abort, not a silent skip.
 *
 * The `'authenticated'` branch is preserved for forward-compat (V2 per-tenant
 * 2FA-skip flag); under v0.5.0+ it is unreachable from `/auth/login`.
 */
import { check, fail } from 'k6';
import http from 'k6/http';
import type { Response } from 'k6/http';

import { completeChallengeViaMailpit } from './2fa-helper.ts';
import { APITEST_EMAIL, APITEST_PASSWORD, BASE_URL } from './config.ts';

export interface AuthState {
  authToken: string;
  refreshToken: string;
  userId: number;
  tenantId: number;
}

/**
 * HTTP-shape mirror of backend `LoginResultBody`
 * (`backend/src/nest/two-factor-auth/two-factor-auth.types.ts`, Step 2.4).
 *
 * Mirrored locally rather than imported because k6 runs in goja under its
 * own tsconfig (`load/tsconfig.json`); cross-package type imports would
 * couple the load suite to backend module-graph rebuilds and break the
 * minimal-surface load-runtime contract documented in ADR-018.
 *
 * The `'authenticated'` branch is intentionally retained — Step 2.4
 * preserves it for a future per-tenant 2FA-skip flag (V2). Unreachable from
 * `/auth/login` under v0.6.x, but kept for forward-compat exhaustiveness.
 */
interface LoginResultAuthenticated {
  stage: 'authenticated';
  accessToken: string;
  refreshToken: string;
  user: { id: number; tenantId: number };
}

interface LoginResultChallenge {
  stage: 'challenge_required';
  challenge: {
    expiresAt: string;
    resendAvailableAt: string;
    resendsRemaining: number;
  };
}

type LoginResultBody = LoginResultAuthenticated | LoginResultChallenge;

/**
 * Validate 200 + branch on the `LoginResultBody` discriminator. The
 * `'challenge_required'` branch is the live path under v0.5.0+ (DD-10
 * removed) and routes through `completeChallengeViaMailpit` to finish the
 * 2FA roundtrip. The `'authenticated'` branch is preserved for forward-compat.
 *
 * `issuedAtMs` MUST be captured by the caller BEFORE the `/auth/login`
 * POST — used to filter stale mails from prior runs (Mailpit persists
 * `mailpit.db` across container restarts; see HOW-TO-DEV-SMTP §5).
 */
function extractAuthState(res: Response, email: string, issuedAtMs: number): AuthState {
  const ok = check(res, {
    'login returns 200': (r) => r.status === 200,
  });
  if (!ok) {
    fail(`Login failed for ${email}: status=${res.status} body=${res.body as string}`);
  }

  // Cast via `unknown` — k6's `res.json()` is typed as `JSONValue`
  // (string | number | boolean | JSONArray | JSONObject | null). The
  // discriminated union's literal `stage` strings don't sufficiently overlap
  // with `JSONObject` for a direct `as` cast in TS 6.x. Routing through
  // `unknown` is the canonical TS idiom for this exact narrowing case.
  const body = res.json() as unknown as { data: LoginResultBody };

  if (body.data.stage === 'challenge_required') {
    // Live path under ADR-054 v0.5.0+. Mailpit-bridge polls for the freshly-
    // issued code (filtered by `issuedAtMs - CLOCK_SKEW_MS`), submits to
    // `/auth/2fa/verify`, and extracts tokens from the response cookies
    // (R8 — tokens never in body). See `./2fa-helper.ts` header for the
    // architectural rationale (zero new backend surface).
    return completeChallengeViaMailpit(email, issuedAtMs);
  }

  // stage === 'authenticated' — currently unreachable from /auth/login but
  // retained for forward-compat (Step 2.4 preserves the branch for a future
  // per-tenant 2FA-skip flag in V2, where the body would carry tokens).
  return {
    authToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    userId: body.data.user.id,
    tenantId: body.data.user.tenantId,
  };
}

/**
 * Generic login for any tenant. Both `loginApitest()` and
 * `baseline.ts:loginAll()` funnel through here so the discriminated-union
 * branch lives in ONE place. The Mailpit-bridge for the 2FA stage is
 * isolated in `./2fa-helper.ts`; swapping in a different test-account
 * mechanism (e.g. a future OAuth-fixture or out-of-band token-mint per
 * FEAT_2FA_EMAIL_MASTERPLAN §Phase 7) only touches that helper.
 *
 * `issuedAtMs` is captured BEFORE the POST so the helper's Mailpit poll
 * filters out stale mails from prior runs (Mailpit retains its mailbox
 * in `assixx_mailpit_data` across container restarts).
 */
export function loginGeneric(email: string, password: string): AuthState {
  const issuedAtMs = Date.now();
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_login' },
  });
  return extractAuthState(res, email, issuedAtMs);
}

/**
 * Login as assixx test-tenant admin. Call from `setup()` — once per test run.
 * Fails loud (aborts test) on non-200 to surface config issues immediately
 * rather than cascading into 401s on every subsequent request.
 */
export function loginApitest(): AuthState {
  return loginGeneric(APITEST_EMAIL, APITEST_PASSWORD);
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
