/**
 * Tenant Domains API Integration Tests — Phase 4 (ADR-048 §4).
 *
 * Covers the full HTTP surface of `/api/v2/domains` plus the TENANT_NOT_VERIFIED
 * user-creation lock enforced by `assertVerified()` in every user-creation
 * service (Phase 2 §2.9). Runs against the real `assixx-backend` container —
 * no in-process mocks. DNS mocking is NOT supported at this layer (see
 * `oauth.api.test.ts` for the same precedent); DNS-positive happy-path is
 * exercised at unit level in `backend/src/nest/domains/domain-verification.
 * service.test.ts` and deferred here via `it.skip`.
 *
 * ── Seed strategy ─────────────────────────────────────────────────────────────
 *   - `apitest` (tenant id=1) is the primary test tenant. It owns a verified
 *     `assixx.com` row, giving us a verified tenant for CRUD tests AND an
 *     established RLS context for cross-tenant isolation assertions.
 *   - `firma-a` (tenant id=2) is the foreign tenant used for RLS assertions.
 *   - Fresh unverified tenants are created via `POST /api/v2/signup` for the
 *     lock / graceful-degradation tests and dropped in `afterAll` (same
 *     pattern as `oauth.api.test.ts::deleteTenantBySubdomain`).
 *
 * ── Cleanup contract ─────────────────────────────────────────────────────────
 *   - Every domain POSTed to apitest is soft-deleted in afterAll (`is_active=4`),
 *     NOT hard-deleted — mirrors prod behavior and preserves audit_trail rows.
 *   - Every temporary tenant created via signup is hard-deleted in afterAll
 *     (tenants table + its tenant_domains + users + tenant_addons + tenant_storage).
 *   - Soft-deleted domains from `assixx.com` remain; only rows this suite added
 *     are touched.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §4
 * @see backend/test/oauth.api.test.ts (cleanup + Redis helpers precedent)
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md (RLS + triple-user model)
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  clear2faStateForUser,
  extractCookieValue,
  fetchLatest2faCode,
  flushThrottleKeys,
} from './helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const RUN_SUFFIX = Date.now();

/** Apitest users — seeded in the fixture (see docs/how-to/HOW-TO-TEST.md). */
const APITEST_ROOT = { email: 'info@assixx.com', password: 'ApiTest12345!' };
const APITEST_ADMIN = { email: 'perm-test-admin@assixx.com', password: 'ApiTest12345!' };
const APITEST_EMPLOYEE = { email: 'employee@assixx.com', password: 'ApiTest12345!' };

/** Generic test password (matches `apitest` seed). */
const TEST_PASSWORD = 'ApiTest12345!';

/** Tracks all domains this test file adds to apitest; afterAll soft-deletes them. */
const CREATED_DOMAIN_IDS_APITEST: string[] = [];

/** Tracks temporary tenants created via signup; afterAll hard-deletes each one. */
const CREATED_SUBDOMAINS: string[] = [];

// ─── Token cache ─────────────────────────────────────────────────────────────

let ROOT_TOKEN = '';
let ADMIN_TOKEN = '';
let EMPLOYEE_TOKEN = '';

/**
 * Lookup user-id by email via direct psql (assixx_user, BYPASSRLS). Returns
 * `null` when the user does not exist — callers can treat that as a soft
 * skip on lockout pre-clean.
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
 * Lookup tenant-id by subdomain via direct psql. Used post-signup to
 * recover the tenant_id that the legacy signup body used to expose
 * (FEAT_2FA_EMAIL Step 2.5: signup body now carries `stage:
 * 'challenge_required'` instead of `tenantId`).
 */
function queryTenantIdBySubdomain(subdomain: string): number | null {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT id FROM tenants WHERE subdomain = '${subdomain}' LIMIT 1"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (out === '') return null;
  const id = Number.parseInt(out, 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Run the full 2-step 2FA login dance and return the access-token cookie.
 * Mirrors the canonical `00-auth.api.test.ts:loginAndVerify()` pattern
 * (FEAT_2FA_EMAIL §Phase 4 / Session 10b — adapts pre-existing files broken
 * by Step 2.4 token-shape change). Mailpit lookup is `since`-scoped so we
 * never depend on Mailpit being globally clean (cross-worker race per
 * §0.5.5 v0.7.2). Lockouts are pre-cleared via `2fa:lock:{userId}` DEL.
 */
async function loginAs(email: string, password: string): Promise<string> {
  const preLookupId = queryUserIdByEmail(email);
  if (preLookupId !== null) clear2faStateForUser(preLookupId);

  const loginStartedAt = new Date();
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    const errBody = await loginRes.text();
    throw new Error(`Login failed for ${email}: HTTP ${String(loginRes.status)} ${errBody}`);
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
    headers: { 'Content-Type': 'application/json', Cookie: `challengeToken=${challengeToken}` },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: HTTP ${String(verifyRes.status)}`);
  }
  const accessToken = extractCookieValue(verifyRes.headers.getSetCookie(), 'accessToken');
  if (accessToken === null) {
    throw new Error(`no accessToken cookie for ${email}`);
  }
  return accessToken;
}

// ─── Direct-DB helpers (bypass RLS via assixx_user for setup/asserts) ────────

function psqlSingle(sql: string): string {
  return execSync(`docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "${sql}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Update a tenant_domains row's status via direct DB (bypasses RLS). Used by
 * the user-creation-lock tests to flip state without exercising the DNS path
 * (which requires mocking not available at the HTTP layer).
 */
function setDomainStatus(tenantId: number, domain: string, status: 'pending' | 'verified'): void {
  const verifiedAt = status === 'verified' ? 'NOW()' : 'NULL';
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "UPDATE tenant_domains SET status='${status}', verified_at=${verifiedAt}, updated_at=NOW() WHERE tenant_id=${String(tenantId)} AND domain='${domain}' AND is_active=1"`,
    { stdio: 'pipe' },
  );
}

function softDeleteDomain(tenantId: number, domain: string): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "UPDATE tenant_domains SET is_active=4, updated_at=NOW() WHERE tenant_id=${String(tenantId)} AND domain='${domain}' AND is_active=1"`,
    { stdio: 'pipe' },
  );
}

function softDeleteDomainById(domainId: string): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "UPDATE tenant_domains SET is_active=4, updated_at=NOW() WHERE id='${domainId}' AND is_active=1"`,
    { stdio: 'pipe' },
  );
}

function deleteTenantBySubdomain(subdomain: string): void {
  const sql =
    `DELETE FROM tenant_addons WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenant_storage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenant_domains WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenants WHERE subdomain = '${subdomain}';`;
  execSync(`docker exec assixx-postgres psql -U assixx_user -d assixx -c "${sql}"`, {
    stdio: 'pipe',
  });
}

function countDomainAuditRows(tenantId: number, action: string): number {
  const out = psqlSingle(
    `SELECT COUNT(*) FROM audit_trail WHERE tenant_id=${String(tenantId)} AND resource_type='domain' AND action='${action}'`,
  );
  return Number.parseInt(out, 10);
}

// ─── Signup helper: create a fresh unverified tenant ─────────────────────────

/**
 * Fetch an employee position id from a freshly-created tenant. New tenants get
 * the default position catalog seeded at signup (same positions as apitest:
 * team_lead, team_deputy_lead, Produktionsmitarbeiter, Anlagenbediener, …).
 * POST /api/v2/users requires `positionIds: z.array(z.uuid()).min(1)` per
 * `backend/src/nest/users/dto/create-user.dto.ts` — without one, Zod 400
 * fires BEFORE `assertVerified()` in the service, which would mask the lock
 * test. This helper returns the first `employee` position so tests can supply
 * a valid body and exercise the lock gate cleanly.
 */
async function getEmployeePositionId(token: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/organigram/positions`, { headers: authOnly(token) });
  if (!res.ok) {
    throw new Error(`Failed to fetch positions: HTTP ${String(res.status)}`);
  }
  const json = (await res.json()) as JsonBody;
  const positions = json.data as Array<{ id: string; name: string; roleCategory: string }>;
  const employeePos = positions.find((p) => p.roleCategory === 'employee');
  if (!employeePos) {
    throw new Error('No employee position found in fresh tenant position catalog');
  }
  return employeePos.id;
}

/**
 * Creates a fresh tenant via signup + logs in as its root. Returns the root
 * access token, the tenant id, and the seeded pending domain. Caller must
 * register the subdomain in `CREATED_SUBDOMAINS` for cleanup (already done
 * here). Uses `.test` TLD so the email passes the 3-layer validator (Layer 2
 * `mailchecker` accepts `.test` per Phase 0 Step 0.4 probe).
 */
async function createFreshTenant(
  label: string,
): Promise<{ token: string; tenantId: number; userId: number; subdomain: string; domain: string }> {
  const subdomain = `p4-${label}-${RUN_SUFFIX}`;
  const domain = `${subdomain}.test`;
  const adminEmail = `root-${RUN_SUFFIX}@${domain}`;
  CREATED_SUBDOMAINS.push(subdomain);

  const signupStartedAt = new Date();
  const signupRes = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: `Phase 4 ${label}`,
      subdomain,
      email: `contact-${RUN_SUFFIX}@${domain}`,
      phone: '+49123456789',
      street: 'Musterstraße',
      houseNumber: '1',
      postalCode: '10115',
      city: 'Berlin',
      countryCode: 'DE',
      adminEmail,
      adminPassword: TEST_PASSWORD,
      adminFirstName: 'Phase',
      adminLastName: 'Tester',
    }),
  });
  if (signupRes.status !== 201) {
    const body = await signupRes.text();
    throw new Error(
      `createFreshTenant[${label}] signup failed: HTTP ${String(signupRes.status)} ${body}`,
    );
  }

  // Post-DD-10 signup contract (FEAT_2FA_EMAIL Step 2.5):
  //   - Body: `{ stage: 'challenge_required', challenge }` — NO tenantId/userId.
  //   - Cookie: `challengeToken` for the freshly-created INACTIVE root user.
  //   - Mailpit: 2FA mail to `adminEmail`.
  //
  // We must:
  //   1. Verify the signup challenge → flips user to is_active=ACTIVE
  //      (otherwise the next /auth/login would hit JwtAuthGuard's is_active
  //      check and 401 the user).
  //   2. Recover the tenant_id + user_id via psql (signup-verify on apex
  //      returns a `handoff` ticket, NOT the IDs the legacy body exposed).
  //   3. Run a regular login + 2FA dance to get the access-token cookie.
  const signupChallenge = extractCookieValue(signupRes.headers.getSetCookie(), 'challengeToken');
  if (signupChallenge === null) {
    throw new Error(`createFreshTenant[${label}]: signup did not issue challengeToken`);
  }
  const signupCode = await fetchLatest2faCode(adminEmail, 10_000, signupStartedAt);
  const signupVerifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `challengeToken=${signupChallenge}` },
    body: JSON.stringify({ code: signupCode }),
  });
  if (!signupVerifyRes.ok) {
    throw new Error(
      `createFreshTenant[${label}]: signup-verify failed: HTTP ${String(signupVerifyRes.status)}`,
    );
  }

  const tenantId = queryTenantIdBySubdomain(subdomain);
  const userId = queryUserIdByEmail(adminEmail);
  if (tenantId === null) {
    throw new Error(`createFreshTenant[${label}]: tenant ${subdomain} missing post-signup`);
  }
  if (userId === null) {
    throw new Error(`createFreshTenant[${label}]: user ${adminEmail} missing post-signup`);
  }

  const token = await loginAs(adminEmail, TEST_PASSWORD);
  return { token, tenantId, userId, subdomain, domain };
}

// ─── Global setup / teardown ─────────────────────────────────────────────────

beforeAll(async () => {
  flushThrottleKeys();

  // Defensive: an earlier file in the api suite may have flipped the apitest
  // tenant's primary domain (assixx.com) out of the `(verified, primary, active)`
  // state — `00-auth.api.test.ts:applyDbPrerequisites` runs ONCE at suite start,
  // and any test between then and here that mutates `tenant_domains` for
  // tenant 1 leaves the row broken for the verification-status / list /
  // verify-idempotent tests below. Mirrors the exact SQL from `00-auth` so
  // the contract is consistent: ON CONFLICT keeps the INSERT a no-op when the
  // row exists; the conditional UPDATE re-verifies a soft-deleted or pending
  // row (no-op when already in the canonical state). Uses `assixx_user`
  // (BYPASSRLS) per ADR-019 — same pattern as the file's `psqlSingle`.
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "` +
      `INSERT INTO tenant_domains (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active) ` +
      `VALUES (1, 'assixx.com', 'verified', substr(md5(random()::text) || md5(random()::text), 1, 64), NOW(), true, 1) ` +
      `ON CONFLICT DO NOTHING; ` +
      `UPDATE tenant_domains SET is_active = 1, status = 'verified', verified_at = COALESCE(verified_at, NOW()), is_primary = true ` +
      `WHERE tenant_id = 1 AND domain = 'assixx.com' ` +
      `AND NOT (is_active = 1 AND is_primary = true AND status = 'verified');"`,
    { stdio: 'pipe' },
  );

  [ROOT_TOKEN, ADMIN_TOKEN, EMPLOYEE_TOKEN] = await Promise.all([
    loginAs(APITEST_ROOT.email, APITEST_ROOT.password),
    loginAs(APITEST_ADMIN.email, APITEST_ADMIN.password),
    loginAs(APITEST_EMPLOYEE.email, APITEST_EMPLOYEE.password),
  ]);
});

afterAll(() => {
  // Soft-delete every domain this file added to apitest (is_active=4 preserves
  // audit_trail rows — matches production behavior).
  for (const id of CREATED_DOMAIN_IDS_APITEST) {
    try {
      softDeleteDomainById(id);
    } catch {
      // Best-effort — test failures must not block subsequent runs.
    }
  }
  // Hard-delete every temporary tenant created for lock / graceful-degradation.
  for (const sub of CREATED_SUBDOMAINS) {
    try {
      deleteTenantBySubdomain(sub);
    } catch {
      // Best-effort.
    }
  }
});

// =============================================================================
// AUTH + ROLE-GATE MATRIX
// =============================================================================

describe('Tenant Domains API — authentication required', () => {
  it('GET /domains returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains`);
    expect(res.status).toBe(401);
  });

  it('POST /domains returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /domains/:id/verify returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000/verify`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /domains/:id/primary returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000/primary`, {
      method: 'PATCH',
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /domains/:id returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('GET /domains/verification-status returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/domains/verification-status`);
    expect(res.status).toBe(401);
  });
});

describe('Tenant Domains API — role gate (root-only endpoints)', () => {
  it('GET /domains as employee returns 403', async () => {
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(EMPLOYEE_TOKEN) });
    expect(res.status).toBe(403);
  });

  it('GET /domains as admin returns 403 (root-only)', async () => {
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ADMIN_TOKEN) });
    expect(res.status).toBe(403);
  });

  it('POST /domains as employee returns 403', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(EMPLOYEE_TOKEN),
      body: JSON.stringify({ domain: 'example.com' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /domains as admin returns 403 (root-only)', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ADMIN_TOKEN),
      body: JSON.stringify({ domain: 'example.com' }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /domains/:id as employee returns 403', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: authOnly(EMPLOYEE_TOKEN),
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /domains/:id/primary as admin returns 403 (root-only)', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000/primary`, {
      method: 'PATCH',
      headers: authOnly(ADMIN_TOKEN),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /domains/verification-status — role gate (root + admin allowed)', () => {
  it('as root returns 200 with { verified: true } for apitest', async () => {
    const res = await fetch(`${BASE_URL}/domains/verification-status`, {
      headers: authOnly(ROOT_TOKEN),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(true);
  });

  it('as admin returns 200 with { verified: true } (admin can read for banner)', async () => {
    const res = await fetch(`${BASE_URL}/domains/verification-status`, {
      headers: authOnly(ADMIN_TOKEN),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    expect(json.data.verified).toBe(true);
  });

  it('as employee returns 403 (no banner-state access)', async () => {
    const res = await fetch(`${BASE_URL}/domains/verification-status`, {
      headers: authOnly(EMPLOYEE_TOKEN),
    });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// GET /domains — list
// =============================================================================

describe('GET /domains — list for apitest (verified tenant)', () => {
  it('returns 200 with an array containing the verified assixx.com row', async () => {
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    const apitestRow = (json.data as JsonBody[]).find((d) => d.domain === 'assixx.com');
    expect(apitestRow).toBeDefined();
    expect(apitestRow?.status).toBe('verified');
    expect(apitestRow).toHaveProperty('id');
    expect(apitestRow).toHaveProperty('tenantId', 1);
    expect(apitestRow).toHaveProperty('isPrimary');
    expect(apitestRow).toHaveProperty('createdAt');
    expect(apitestRow).toHaveProperty('updatedAt');
  });

  it('never includes verificationInstructions in list rows (§0.2.5 #10)', async () => {
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const json = (await res.json()) as JsonBody;
    for (const row of json.data as JsonBody[]) {
      expect(row.verificationInstructions).toBeUndefined();
    }
  });
});

// =============================================================================
// POST /domains — add (happy + negative)
// =============================================================================

describe('POST /domains — business-domain validation', () => {
  it('rejects gmail.com with 400 FREE_EMAIL_PROVIDER', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: 'gmail.com' }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(400);
    expect(json.error?.code).toBe('FREE_EMAIL_PROVIDER');
  });

  it('rejects mailinator.com with 400 DISPOSABLE_DOMAIN', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: 'mailinator.com' }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(400);
    expect(json.error?.code).toBe('DISPOSABLE_DOMAIN');
  });

  it('rejects malformed domain "not-a-domain" with 400 (VALIDATION_ERROR or INVALID_DOMAIN_FORMAT)', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: 'not-a-domain' }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(400);
    // Either Zod DTO regex catches first (VALIDATION_ERROR) or the service's
    // RFC-1035 regex (INVALID_DOMAIN_FORMAT). Both are acceptable rejections.
    expect(['VALIDATION_ERROR', 'INVALID_DOMAIN_FORMAT']).toContain(json.error?.code);
  });
});

describe('POST /domains — positive path', () => {
  const newDomain = `phase4-add-${RUN_SUFFIX}.de`;
  let addedId: string;
  let addedResponse: JsonBody;

  it('creates pending row + returns verificationInstructions ONLY on add-response', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: newDomain }),
    });
    addedResponse = (await res.json()) as JsonBody;
    expect(res.status).toBe(201);
    expect(addedResponse.success).toBe(true);
    expect(addedResponse.data.domain).toBe(newDomain);
    expect(addedResponse.data.status).toBe('pending');
    expect(addedResponse.data.isPrimary).toBe(false); // first non-seed add is non-primary
    expect(addedResponse.data.verificationInstructions).toBeDefined();
    expect(addedResponse.data.verificationInstructions.txtHost).toBe(`_assixx-verify.${newDomain}`);
    expect(addedResponse.data.verificationInstructions.txtValue).toMatch(
      /^assixx-verify=[0-9a-f]{64}$/,
    );

    addedId = addedResponse.data.id as string;
    CREATED_DOMAIN_IDS_APITEST.push(addedId);
  });

  it('returns 409 DOMAIN_ALREADY_ADDED on duplicate add (same tenant + domain)', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: newDomain }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(409);
    expect(json.error?.code).toBe('DOMAIN_ALREADY_ADDED');
  });
});

// =============================================================================
// POST /domains — cross-tenant pre-check (post-v1 "Option A" hardening, 2026-04-20)
//
// Adds surface the DOMAIN_ALREADY_CLAIMED 409 at add-time if another tenant has
// already verified the domain, instead of letting the row sit pending forever
// (the user can never win the DNS challenge — they don't control that domain).
// Hermetic setup: a throwaway tenant is created via signup, its seeded pending
// row is flipped to 'verified' via the DB helper (bypasses the DNS layer the
// HTTP surface can't mock), then apitest-root tries to add the same domain.
// =============================================================================

describe('POST /domains — cross-tenant pre-check (DOMAIN_ALREADY_CLAIMED)', () => {
  let foreignTenantId: number;
  let foreignDomain: string;

  beforeAll(async () => {
    const fresh = await createFreshTenant('claim');
    foreignTenantId = fresh.tenantId;
    foreignDomain = fresh.domain;
    // Flip the signup-seeded pending row to verified without exercising DNS.
    // Same precedent as the user-creation-lock tests further down.
    setDomainStatus(foreignTenantId, foreignDomain, 'verified');
  });

  it('rejects the add with 409 DOMAIN_ALREADY_CLAIMED', async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: foreignDomain }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(409);
    expect(json.error?.code).toBe('DOMAIN_ALREADY_CLAIMED');
    // Message is German + user-facing — locked here so a future refactor
    // can't silently drop the "anderen Assixx-Tenant" phrasing that the UI
    // toast relies on (frontend reads `err.message` via getApiErrorMessage,
    // no client-side i18n layer between backend and toast).
    expect(json.error?.message).toContain('anderen Assixx-Tenant');
  });

  it('allows the add when the foreign tenant has the domain only in pending', async () => {
    // Flip foreign row back to pending. Pending-pending cross-tenant
    // coexistence is explicitly allowed — preserves the masterplan's
    // no-squatting-DoS property. The apitest INSERT must succeed.
    setDomainStatus(foreignTenantId, foreignDomain, 'pending');
    // Can't hit `NOW()` in setDomainStatus's verified-at for a pending flip —
    // helper zeroes it to NULL, matching the invariant.

    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: foreignDomain }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(201);
    expect(json.data.status).toBe('pending');
    CREATED_DOMAIN_IDS_APITEST.push(json.data.id as string);
  });
});

// =============================================================================
// POST /domains/:id/verify — DNS-negative path (HTTP-layer feasible)
// =============================================================================

describe('POST /domains/:id/verify — DNS negative path', () => {
  let pendingId: string;
  const domain = `phase4-verify-${RUN_SUFFIX}.test`;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain }),
    });
    const json = (await res.json()) as JsonBody;
    // Setup guard (not an assertion) — `expect()` is forbidden in `beforeAll`
    // by `vitest/no-standalone-expect`. Throw fails the whole describe with a
    // clear error if the setup POST broke; matches the org-scope.api.test.ts
    // convention. Pattern documented in HOW-TO-TEST.md §Auth.
    if (res.status !== 201) {
      throw new Error(`Setup: POST /domains for verify test returned HTTP ${String(res.status)}`);
    }
    pendingId = json.data.id as string;
    CREATED_DOMAIN_IDS_APITEST.push(pendingId);
  });

  it('on NXDOMAIN target (.test TLD never resolves), 201 Created and status stays pending', async () => {
    // `.test` is reserved (RFC 6761), always NXDOMAIN. `verify()` catches
    // DNS errors and returns false → status unchanged, row returned as-is.
    // Nest defaults POST response to 201 Created — `@Post(':id/verify')` has no
    // `@HttpCode(200)` override, so the success status IS 201 even when the
    // status of the row itself remains 'pending'.
    const res = await fetch(`${BASE_URL}/domains/${pendingId}/verify`, {
      method: 'POST',
      headers: authOnly(ROOT_TOKEN),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(201);
    expect(json.data.status).toBe('pending');
    expect(json.data.verifiedAt).toBeNull();
  });

  it('is idempotent on already-verified rows (assixx.com)', async () => {
    // Use assixx.com directly — already verified. Need its id first.
    const listRes = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const listJson = (await listRes.json()) as JsonBody;
    const apitestDotDe = (listJson.data as JsonBody[]).find((d) => d.domain === 'assixx.com');
    expect(apitestDotDe).toBeDefined();

    const verifyRes = await fetch(`${BASE_URL}/domains/${apitestDotDe!.id as string}/verify`, {
      method: 'POST',
      headers: authOnly(ROOT_TOKEN),
    });
    const verifyJson = (await verifyRes.json()) as JsonBody;
    expect(verifyRes.status).toBe(201);
    expect(verifyJson.data.status).toBe('verified');
    // Idempotent: no DNS call made for already-verified rows (§2.5 comment).
  });
});

// =============================================================================
// PATCH /domains/:id/primary
// =============================================================================

describe('PATCH /domains/:id/primary', () => {
  let newPrimaryId: string;
  const pdomain = `phase4-primary-${RUN_SUFFIX}.de`;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: pdomain }),
    });
    const json = (await res.json()) as JsonBody;
    // Setup guard (not an assertion) — see verify-test beforeAll comment.
    if (res.status !== 201) {
      throw new Error(`Setup: POST /domains for primary test returned HTTP ${String(res.status)}`);
    }
    newPrimaryId = json.data.id as string;
    CREATED_DOMAIN_IDS_APITEST.push(newPrimaryId);
  });

  it('returns 204 and flips the row to is_primary=true', async () => {
    const res = await fetch(`${BASE_URL}/domains/${newPrimaryId}/primary`, {
      method: 'PATCH',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(204);
    // Verify DB state directly — service returns 204 No Content.
    const listRes = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const listJson = (await listRes.json()) as JsonBody;
    const newPrimary = (listJson.data as JsonBody[]).find((d) => d.id === newPrimaryId);
    expect(newPrimary?.isPrimary).toBe(true);
  });

  it('returns 404 for an unknown domain id', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000/primary`, {
      method: 'PATCH',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// DELETE /domains/:id
// =============================================================================

describe('DELETE /domains/:id', () => {
  let delId: string;
  const ddomain = `phase4-del-${RUN_SUFFIX}.de`;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: ddomain }),
    });
    const json = (await res.json()) as JsonBody;
    // Setup guard (not an assertion) — see verify-test beforeAll comment.
    if (res.status !== 201) {
      throw new Error(`Setup: POST /domains for delete test returned HTTP ${String(res.status)}`);
    }
    delId = json.data.id as string;
    // Don't add to CREATED_DOMAIN_IDS_APITEST — this test deletes it itself.
  });

  it('returns 204 on soft-delete of own pending domain', async () => {
    const res = await fetch(`${BASE_URL}/domains/${delId}`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(204);
    // Verify the row is gone from the active-list (is_active=4 filters it out).
    const listRes = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const listJson = (await listRes.json()) as JsonBody;
    const found = (listJson.data as JsonBody[]).find((d) => d.id === delId);
    expect(found).toBeUndefined();
  });

  it('returns 404 on a subsequent DELETE of the same row (already-deleted)', async () => {
    const res = await fetch(`${BASE_URL}/domains/${delId}`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent domain id', async () => {
    const res = await fetch(`${BASE_URL}/domains/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Soft-delete + re-add round-trip (migration 20260419002936537 regression guard)
// =============================================================================

/**
 * Guards the partial UNIQUE INDEX `tenant_domains_tenant_domain_unique`
 * (`WHERE is_active = 1`) introduced by migration
 * `20260419002936537_partial-tenant-domain-uniqueness.ts`.
 *
 * Before that migration the per-tenant-domain uniqueness was a plain UNIQUE
 * CONSTRAINT — soft-deleted rows (is_active=4) kept occupying the uniqueness
 * slot, so a re-add of the same domain returned 409 DOMAIN_ALREADY_ADDED even
 * though `DELETE /domains/:id` had "removed" the row. Masterplan §3 D22
 * unit-test only passed because the mock bypassed PostgreSQL's constraint
 * check; live smoke-testing surfaced the gap on 2026-04-19.
 *
 * This test exercises the real PG constraint end-to-end — no mocks — so a
 * future regression (e.g., someone accidentally re-adds a plain UNIQUE
 * constraint on the same columns) trips CI immediately.
 */
describe('POST /domains after DELETE re-adds successfully (partial-index contract)', () => {
  const roundtripDomain = `phase4-roundtrip-${RUN_SUFFIX}.de`;

  it('re-add after soft-delete returns 201 with a FRESH token and a NEW row id', async () => {
    // 1. Initial add — get first id + token.
    const firstAdd = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: roundtripDomain }),
    });
    expect(firstAdd.status).toBe(201);
    const firstJson = (await firstAdd.json()) as JsonBody;
    const firstId = firstJson.data.id as string;
    const firstToken = (firstJson.data.verificationInstructions as JsonBody).txtValue as string;

    // 2. Soft-delete → 204.
    const del = await fetch(`${BASE_URL}/domains/${firstId}`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(del.status).toBe(204);

    // 3. Re-add same domain — would have been 409 DOMAIN_ALREADY_ADDED before
    //    migration 20260419002936537; now must be 201 with a fresh row+token.
    const secondAdd = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: roundtripDomain }),
    });
    expect(secondAdd.status).toBe(201);
    const secondJson = (await secondAdd.json()) as JsonBody;
    const secondId = secondJson.data.id as string;
    const secondToken = (secondJson.data.verificationInstructions as JsonBody).txtValue as string;

    // 4. Fresh identifiers — NOT the same row reactivated.
    expect(secondId).not.toBe(firstId);
    expect(secondToken).not.toBe(firstToken);

    // 5. DB snapshot — both rows coexist: the soft-deleted with is_active=4
    //    and the newly-added with is_active=1. The partial UNIQUE INDEX allows
    //    this by scoping uniqueness to `WHERE is_active = 1`.
    const activeRowCount = psqlSingle(
      `SELECT COUNT(*) FROM tenant_domains WHERE tenant_id=1 AND domain='${roundtripDomain}' AND is_active=1`,
    );
    expect(activeRowCount).toBe('1');
    const softDeletedCount = psqlSingle(
      `SELECT COUNT(*) FROM tenant_domains WHERE tenant_id=1 AND domain='${roundtripDomain}' AND is_active=4`,
    );
    expect(softDeletedCount).toBe('1');

    // Cleanup: soft-delete the re-added row so afterAll doesn't leave an
    // orphan active row that would block a future re-run on the same RUN_SUFFIX.
    softDeleteDomainById(secondId);
  });
});

// =============================================================================
// RLS cross-tenant isolation
// =============================================================================

describe('RLS cross-tenant isolation', () => {
  it("GET /domains as apitest root never leaks another tenant's rows", async () => {
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    // Every row MUST be tenantId=1 (apitest). If RLS were misconfigured the
    // list would also include tenant 2/3/4 rows from the seed.
    for (const row of json.data as JsonBody[]) {
      expect(row.tenantId).toBe(1);
    }
    // Sanity: seed has verified domains for tenants 2, 3, 4 — assert we
    // do NOT see firma-a.test / firma-b.test / scs-technik.de here.
    const domains = (json.data as JsonBody[]).map((d) => d.domain);
    expect(domains).not.toContain('firma-a.test');
    expect(domains).not.toContain('firma-b.test');
    expect(domains).not.toContain('scs-technik.de');
  });

  it('DELETE on a foreign tenant domain id returns 404 (RLS blocks the lookup)', async () => {
    // Fetch firma-a's domain id via direct DB (BYPASSRLS), then try to DELETE
    // as apitest root. The service's `findOneActive` filters by tenant_id so
    // the row is not found from apitest's context → 404.
    const firmaAId = psqlSingle(
      `SELECT id FROM tenant_domains WHERE domain='firma-a.test' AND tenant_id=2 LIMIT 1`,
    );
    expect(firmaAId).not.toBe('');
    const res = await fetch(`${BASE_URL}/domains/${firmaAId}`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(res.status).toBe(404);
    // Double-check: firma-a.test row is still active for tenant 2.
    const still = psqlSingle(`SELECT is_active FROM tenant_domains WHERE id='${firmaAId}'`);
    expect(still).toBe('1');
  });
});

// =============================================================================
// USER-CREATION LOCK — TENANT_NOT_VERIFIED gate (§2.6 / §2.9)
// =============================================================================

describe('User-creation lock — TENANT_NOT_VERIFIED gate', () => {
  let fresh: { token: string; tenantId: number; userId: number; subdomain: string; domain: string };
  let positionId: string;

  beforeAll(async () => {
    fresh = await createFreshTenant('lock');
    // Fetch a valid position BEFORE the lock tests run. /organigram/positions
    // is read-only and not gated by assertVerified(), so it works even for
    // unverified tenants. Every test below supplies `positionIds: [positionId]`
    // so Zod DTO validation passes and the assertVerified() gate is the
    // EXCLUSIVE reason for 403 (or its absence) across all three states.
    positionId = await getEmployeePositionId(fresh.token);
  });

  /**
   * Build a valid CreateUserDto body with a varied, SHORT-local-part email.
   * `users.username` is `VARCHAR(50)` and some code paths set `username=email`;
   * short prefixes (`u1/u2/u3`) keep the full email under 50 chars even with
   * the timestamp + `.test` TLD suffix.
   */
  function userBody(localPart: string): Record<string, unknown> {
    return {
      email: `${localPart}-${String(RUN_SUFFIX).slice(-6)}@${fresh.domain}`,
      password: TEST_PASSWORD,
      firstName: 'Lock',
      lastName: 'Tester',
      role: 'employee',
      positionIds: [positionId],
    };
  }

  it('unverified tenant: POST /api/v2/users returns 403 TENANT_NOT_VERIFIED', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(fresh.token),
      body: JSON.stringify(userBody('u1')),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(403);
    expect(json.error?.code).toBe('TENANT_NOT_VERIFIED');
  });

  it('after flipping status=verified via DB, POST /api/v2/users returns 201', async () => {
    setDomainStatus(fresh.tenantId, fresh.domain, 'verified');
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(fresh.token),
      body: JSON.stringify(userBody('u2')),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as JsonBody;
    expect(json.data?.id).toBeTypeOf('number');
  });

  it('after soft-deleting the verified domain via DB, POST /api/v2/users returns 403 (re-lock)', async () => {
    softDeleteDomain(fresh.tenantId, fresh.domain);
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(fresh.token),
      body: JSON.stringify(userBody('u3')),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(403);
    expect(json.error?.code).toBe('TENANT_NOT_VERIFIED');
  });
});

// =============================================================================
// GRACEFUL DEGRADATION (v0.3.4 D27)
// =============================================================================

describe('Graceful degradation on last-verified-domain removal (v0.3.4 D27)', () => {
  let fresh: { token: string; tenantId: number; userId: number; subdomain: string; domain: string };
  let positionId: string;

  beforeAll(async () => {
    fresh = await createFreshTenant('gdeg');
    positionId = await getEmployeePositionId(fresh.token);
    // Flip verified so we can create test users with the normal API path.
    setDomainStatus(fresh.tenantId, fresh.domain, 'verified');

    // Create at least one additional user while tenant is verified so we can
    // later assert that user still works after the verified domain is removed.
    // Short email local-part to stay under users.username VARCHAR(50).
    const createRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(fresh.token),
      body: JSON.stringify({
        email: `ge-${String(RUN_SUFFIX).slice(-6)}@${fresh.domain}`,
        password: TEST_PASSWORD,
        firstName: 'Graceful',
        lastName: 'Degrader',
        role: 'employee',
        positionIds: [positionId],
      }),
    });
    if (createRes.status !== 201) {
      const body = await createRes.text();
      throw new Error(
        `Graceful-degradation setup: user create failed HTTP ${String(createRes.status)}: ${body}`,
      );
    }

    // Now soft-delete the only verified domain → tenant should re-lock user-creation.
    softDeleteDomain(fresh.tenantId, fresh.domain);
  });

  it('existing root user can still login after last-verified-domain removal', async () => {
    // Post-DD-10: `/auth/login` issues a 2FA challenge instead of tokens
    // (FEAT_2FA_EMAIL Step 2.4 + ADR-005). The credential check + challenge
    // issuance is what proves the login path stays open through the
    // graceful-degradation lock — we don't need to drive the verify step
    // here because the test's intent is "auth still works after the last
    // verified domain is gone".
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `root-${RUN_SUFFIX}@${fresh.domain}`,
        password: TEST_PASSWORD,
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as JsonBody;
    expect(json.data.stage).toBe('challenge_required');
  });

  it('existing user can still GET /users/me after degradation', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, { headers: authOnly(fresh.token) });
    expect(res.status).toBe(200);
  });

  it('NEW user-creation returns 403 TENANT_NOT_VERIFIED (re-lock)', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(fresh.token),
      body: JSON.stringify({
        email: `gb-${String(RUN_SUFFIX).slice(-6)}@${fresh.domain}`,
        password: TEST_PASSWORD,
        firstName: 'Blocked',
        lastName: 'Create',
        role: 'employee',
        positionIds: [positionId],
      }),
    });
    const json = (await res.json()) as JsonBody;
    expect(res.status).toBe(403);
    expect(json.error?.code).toBe('TENANT_NOT_VERIFIED');
  });
});

// =============================================================================
// AUDIT-TRAIL SMOKE (v0.3.4 D29)
// =============================================================================

describe('Audit-trail smoke — domain CRUD mutations are auto-logged', () => {
  it('POST/DELETE on /domains produce audit_trail rows with resource_type=domain', async () => {
    const beforeCreate = countDomainAuditRows(1, 'create');
    const beforeDelete = countDomainAuditRows(1, 'delete');

    const addRes = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: `phase4-audit-${RUN_SUFFIX}.de` }),
    });
    const addJson = (await addRes.json()) as JsonBody;
    expect(addRes.status).toBe(201);
    const auditId = addJson.data.id as string;
    CREATED_DOMAIN_IDS_APITEST.push(auditId);

    const delRes = await fetch(`${BASE_URL}/domains/${auditId}`, {
      method: 'DELETE',
      headers: authOnly(ROOT_TOKEN),
    });
    expect(delRes.status).toBe(204);

    // Audit-interceptor writes are fire-and-forget; allow a brief settle.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const afterCreate = countDomainAuditRows(1, 'create');
    const afterDelete = countDomainAuditRows(1, 'delete');
    expect(afterCreate).toBeGreaterThan(beforeCreate);
    expect(afterDelete).toBeGreaterThan(beforeDelete);
  });
});

// =============================================================================
// RATE-LIMIT TIERS (v0.3.4 D28) — runs LAST; consumes token budget
// =============================================================================

describe('Rate-limit tiers (§2.7) — domain-verify narrow tier', () => {
  let verifyTargetId: string;
  const verifyDomain = `phase4-rl-${RUN_SUFFIX}.test`;

  beforeAll(async () => {
    // Fresh pending row to fire /verify against. `.test` TLD → NXDOMAIN → all
    // calls return 200 with unchanged status, so what we're measuring is the
    // throttle tier's counter, not the verification outcome.
    const res = await fetch(`${BASE_URL}/domains`, {
      method: 'POST',
      headers: authHeaders(ROOT_TOKEN),
      body: JSON.stringify({ domain: verifyDomain }),
    });
    const json = (await res.json()) as JsonBody;
    // Setup guard (not an assertion) — see verify-test beforeAll comment.
    if (res.status !== 201) {
      throw new Error(`Setup: POST /domains for throttle test returned HTTP ${String(res.status)}`);
    }
    verifyTargetId = json.data.id as string;
    CREATED_DOMAIN_IDS_APITEST.push(verifyTargetId);
    flushThrottleKeys(); // clean slate for the counter.
  });

  it('domain-verify tier (10/10min): at least one 429 within 15 sequential calls', async () => {
    let saw429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${BASE_URL}/domains/${verifyTargetId}/verify`, {
        method: 'POST',
        headers: authOnly(ROOT_TOKEN),
      });
      // 200 expected for ≤10 calls (NXDOMAIN → pending), 429 once the tier
      // limit trips. Accept 500 defensively (DNS timeout races) — the gate
      // under test is the 429, not the happy path.
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it('tier isolation: after domain-verify exhausted, GET /domains still returns 200', async () => {
    // General `UserThrottle` is a separate token bucket (1000/15min), so
    // exhausting `domain-verify` must NOT spill over to the general tier.
    const res = await fetch(`${BASE_URL}/domains`, { headers: authOnly(ROOT_TOKEN) });
    expect(res.status).toBe(200);
  });

  // eslint-disable-next-line vitest/no-disabled-tests -- ADR-049 §Test Coverage Tier 2: general `UserThrottle` (1000/15min) deferred — suite-runtime budget (~30s+ request bursts); tier definition is unit-tested. `.skip` over `.todo` to preserve the inline rationale as architectural documentation.
  it.skip('general UserThrottle (1000/15min) — deferred: would require 1000+ requests + slow the suite; covered by existing throttle unit tests', () => {
    // Rationale: the general UserThrottle limit is 1000 req / 15 min. Exercising
    // it would add ~30s+ of request bursts to an already-heavy integration
    // suite. The tier definition itself is unit-tested in the throttler module
    // (`backend/src/nest/throttler/throttler.module.test.ts` if present, else
    // sitewide ThrottleGuard coverage). This skip documents the trade-off.
  });
});

// =============================================================================
// DEFERRED — covered at unit level or Phase 6 manual smoke
// =============================================================================

/* eslint-disable vitest/no-disabled-tests --
 * ADR-049 §Test Coverage Tier 2: 3 deferred integration tests (DNS-positive
 * verify + OAuth concurrent-race ×2). HTTP-layer mocking of `node:dns` and
 * Microsoft's token/userinfo endpoints is infeasible from a backend-in-container
 * + test-in-host setup — there is no process-hook from the test into the
 * backend's resolver. Coverage IS in place at the unit tier via `vi.mock` in
 * `domain-verification.service.test.ts` and `signup.service.test.ts`; the
 * real-DNS path is Phase 6 manual smoke. `.skip` over `.todo` is deliberate:
 * the test bodies preserve architectural intent (what WOULD be asserted once
 * upstream mocking is supported) and map back to the unit-level replacements.
 * The matching `eslint-enable` at EOF bounds the suppression so future appended
 * tests don't silently inherit it.
 */
describe.skip('Deferred — DNS-positive verify', () => {
  it.skip('POST /:id/verify with matching TXT record flips to verified — DNS mock unavailable at HTTP layer; unit-tested in domain-verification.service.test.ts', () => {
    // Plan §4 calls for "mock DNS to return matching value" at the integration
    // layer. That mocking is impossible here: the backend runs in a container
    // and `node:dns` resolves via the container's resolver → WSL2 bridge →
    // upstream. There is no hook into the backend process from the test.
    // The happy-path flow IS covered at unit level (`vi.mock('node:dns/promises')`
    // in `backend/src/nest/domains/domain-verification.service.test.ts`).
    // Phase 6 manual smoke covers the end-to-end path with a real DNS record.
  });
});

describe.skip('Deferred — OAuth concurrent-race (v0.3.4 D26)', () => {
  it.skip('Two parallel OAuth callbacks on same Microsoft domain — Phase 6 manual smoke', () => {
    // Same constraint as `oauth.api.test.ts::describe('Deferred to Phase 6')`:
    // backend-process HTTP mocking of Microsoft's token/userinfo endpoints is
    // not supported here. The true-concurrent 23505 path is exercised via
    // `vi.mock` in `backend/src/nest/signup/signup.service.test.ts`
    // (seedVerifiedDomain → partial UNIQUE INDEX → ConflictException).
  });
  it.skip('Password-signup + OAuth-seed race on same domain — Phase 6 manual smoke', () => {
    // Same rationale as above. Unit-level race coverage already in place.
  });
});
/* eslint-enable vitest/no-disabled-tests */
