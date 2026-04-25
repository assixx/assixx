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
 * root token (`admin@apitest.de` has role=root despite the misleading
 * email). We need a real `admin` role to exercise the 403 paths.
 *
 * Cleanup: the suite flips the policy during tests but restores `false`
 * (the default) in `afterAll` so subsequent test runs start from a known
 * state.
 *
 * @see ADR-018 Testing Strategy (Tier 2: real HTTP)
 * @see ADR-045 Permission & Visibility Design
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

// ─── Test users ──────────────────────────────────────────────────────────────
// perm-test-admin has role=admin in tenant 1 (same tenant as apitest root).
// employee@apitest.de has role=employee in tenant 1.
const ADMIN_EMAIL = 'perm-test-admin@apitest.de';
const EMPLOYEE_EMAIL = 'employee@apitest.de';

let rootAuth: AuthState;
let adminToken: string;

/**
 * Ad-hoc login for non-root users. `loginApitest` only caches the root
 * token; we cannot reuse the cache for a different email. Keep the helper
 * inline — this is the only test that needs it, no point polluting
 * helpers.ts.
 */
async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: APITEST_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as JsonBody;
  return body.data.accessToken as string;
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
