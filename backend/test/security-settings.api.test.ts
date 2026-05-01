/**
 * Security Settings API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * Covers (per ADR-045 + user-request 2026-04-20):
 * - GET policy — open to every authenticated role (every layout SSR needs
 *   it to render/hide the password card)
 * - PUT policy — `@Roles('root')` only; admin → 403
 * - `PUT /users/me/password` — blocked for admins when policy=false,
 *   root bypasses the gate
 * - Zod validation rejects malformed bodies (400)
 *
 * WHY separate admin login (not `loginApitest`): loginApitest returns a
 * root token (`info@assixx.com` has role=root despite the misleading
 * email). We need a real `admin` role to exercise the 403 paths.
 *
 * Cleanup: the suite flips the policy during tests but restores `false`
 * (the default) in `afterAll` so subsequent test runs start from a known
 * state.
 *
 * @see ADR-018 Testing Strategy (Tier 2: real HTTP)
 * @see ADR-045 Permission & Visibility Design
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  clear2faStateForUser,
  extractCookieValue,
  fetchLatest2faCode,
  loginApitest,
} from './helpers.js';

// ─── Test users ──────────────────────────────────────────────────────────────
// perm-test-admin has role=admin in tenant 1 (same tenant as apitest root).
// employee@assixx.com has role=employee in tenant 1.
const ADMIN_EMAIL = 'perm-test-admin@assixx.com';
const EMPLOYEE_EMAIL = 'employee@assixx.com';

let rootAuth: AuthState;
let adminToken: string;

/**
 * Lookup user-id by email via direct psql so `loginAs` can pre-clear stale
 * 2FA lockouts without needing to know the id at the call-site.
 */
function queryUserIdByEmail(email: string): number | null {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT id FROM users WHERE email = '${email}' LIMIT 1"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (out === '') return null;
  const id = Number.parseInt(out, 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Ad-hoc 2FA-aware login for non-root users. `loginApitest` only caches the
 * root token; we cannot reuse the cache for a different email. Mirrors the
 * `00-auth.api.test.ts:loginAndVerify()` pattern (FEAT_2FA_EMAIL §Phase 4 /
 * Session 10b — adapts pre-existing files broken by Step 2.4 token-shape
 * change). Mailpit lookup is `since`-scoped — never call `clearMailpit()`
 * here (cross-worker race per §0.5.5 v0.7.2).
 */
async function loginAs(email: string): Promise<string> {
  const preLookupId = queryUserIdByEmail(email);
  if (preLookupId !== null) clear2faStateForUser(preLookupId);

  const loginStartedAt = new Date();
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: APITEST_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed for ${email}: ${String(loginRes.status)} ${loginRes.statusText}`);
  }
  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`unexpected login stage for ${email}: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error(`no challengeToken cookie for ${email}`);
  }

  const code = await fetchLatest2faCode(email, 10_000, loginStartedAt);
  const verifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
      // ADR-050 + ADR-054: same-origin Set-Cookie branch (helpers.ts mirror).
      'X-Forwarded-Host': 'assixx.assixx.com',
    },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: ${String(verifyRes.status)}`);
  }
  const accessToken = extractCookieValue(verifyRes.headers.getSetCookie(), 'accessToken');
  if (accessToken === null) {
    throw new Error(`no accessToken cookie for ${email}`);
  }
  return accessToken;
}

async function setPolicy(token: string, allowed: boolean): Promise<Response> {
  return await fetch(`${BASE_URL}/security-settings/user-password-change-policy`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ allowed }),
  });
}

beforeAll(async () => {
  rootAuth = await loginApitest();
  adminToken = await loginAs(ADMIN_EMAIL);
  // Start every run from a known state — policy = false (default).
  await setPolicy(rootAuth.authToken, false);
});

afterAll(async () => {
  // Leave the policy OFF so the tenant database matches the product
  // default. Any future test that depends on a flipped-on state must
  // flip it itself.
  await setPolicy(rootAuth.authToken, false);
});

// ─── GET policy (all authenticated roles) ────────────────────────────────────

describe('Security-Settings: GET policy', () => {
  it('rejects unauthenticated GET with 401', async () => {
    const res = await fetch(`${BASE_URL}/security-settings/user-password-change-policy`);
    expect(res.status).toBe(401);
  });

  it('returns allowed=false by default (for admin reader)', async () => {
    const res = await fetch(`${BASE_URL}/security-settings/user-password-change-policy`, {
      headers: authOnly(adminToken),
    });
    const body = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ allowed: false });
  });
});

// ─── PUT policy (root-only) ──────────────────────────────────────────────────

describe('Security-Settings: PUT policy (root-only)', () => {
  it('admin PUT is rejected with 403', async () => {
    const res = await setPolicy(adminToken, true);
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('root');
  });

  it('root PUT true persists and echoes allowed=true', async () => {
    const res = await setPolicy(rootAuth.authToken, true);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data).toEqual({ allowed: true });

    // Verify round-trip via GET
    const getRes = await fetch(`${BASE_URL}/security-settings/user-password-change-policy`, {
      headers: authOnly(adminToken),
    });
    const getBody = (await getRes.json()) as JsonBody;
    expect(getBody.data).toEqual({ allowed: true });
  });

  it('rejects malformed body with 400 (Zod validation)', async () => {
    // `allowed: "yes"` is a string, Zod schema requires boolean
    const res = await fetch(`${BASE_URL}/security-settings/user-password-change-policy`, {
      method: 'PUT',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({ allowed: 'yes' }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Password-change gate (UserProfileService enforcement) ───────────────────

describe('Security-Settings: Password-change gate', () => {
  it('admin CAN attempt password change when policy=true (hits bcrypt, 401 on wrong pw)', async () => {
    // Precondition: policy was set to true in the previous describe block.
    // Admin request reaches bcrypt — wrong current password returns 401,
    // NOT 403. This proves the policy gate let us through.
    const res = await fetch(`${BASE_URL}/users/me/password`, {
      method: 'PUT',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        currentPassword: 'definitely-not-the-real-password',
        newPassword: 'NewApiTest12345!',
        confirmPassword: 'NewApiTest12345!',
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as JsonBody;
    expect(body.error.message).toContain('password');
  });

  it('admin gets 403 on password change when policy=false', async () => {
    // Flip policy OFF — admin must now be blocked BEFORE bcrypt runs.
    await setPolicy(rootAuth.authToken, false);

    const res = await fetch(`${BASE_URL}/users/me/password`, {
      method: 'PUT',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        currentPassword: APITEST_PASSWORD,
        newPassword: 'NewApiTest12345!',
        confirmPassword: 'NewApiTest12345!',
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body.error.message).toContain('disabled');
  });

  it('employee gets 403 on password change when policy=false', async () => {
    const employeeToken = await loginAs(EMPLOYEE_EMAIL);
    const res = await fetch(`${BASE_URL}/users/me/password`, {
      method: 'PUT',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({
        currentPassword: APITEST_PASSWORD,
        newPassword: 'NewApiTest12345!',
        confirmPassword: 'NewApiTest12345!',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('root bypasses the gate even when policy=false (hits bcrypt, 401 on wrong pw)', async () => {
    // Policy is still OFF here. Root request must reach bcrypt — wrong
    // current password returns 401, NOT 403. Proves the bypass branch.
    const res = await fetch(`${BASE_URL}/users/me/password`, {
      method: 'PUT',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({
        currentPassword: 'definitely-not-the-real-password',
        newPassword: 'NewApiTest12345!',
        confirmPassword: 'NewApiTest12345!',
      }),
    });
    expect(res.status).toBe(401);
  });
});
