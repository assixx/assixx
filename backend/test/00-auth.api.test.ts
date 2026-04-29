/**
 * Auth API Integration Tests
 *
 * Runs against the REAL backend (Docker must be running).
 * Uses native fetch() -- no mocking, no HTTP client libraries.
 *
 * NOTE: This file does NOT use helpers.ts loginApitest() for the auth-shape
 * assertions because it tests the login + 2FA verify endpoints directly.
 * Other test files use the cached helper. The shared 2FA / Maildev / Redis
 * cleanup utilities ARE imported from helpers.ts to keep the contract in one
 * place (FEAT_2FA_EMAIL_MASTERPLAN Session 10).
 *
 * Phase 2 (Step 2.4) hardcoded email-based 2FA on every password login —
 * `/auth/login` no longer returns tokens; it returns
 * `{ stage: 'challenge_required', challenge }` and sets a `challengeToken`
 * httpOnly cookie. Tokens are issued by `/auth/2fa/verify` as `accessToken` +
 * `refreshToken` httpOnly cookies (NOT in the body, R8). Phase 2 (Step 2.5)
 * applies the same shape to `/signup`: tenant + user rows are created at
 * is_active=INACTIVE, the response carries the same discriminated union, and
 * the user is activated only when the 2FA verify succeeds.
 *
 * @see vitest.config.ts (project: api)
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md Phase 2 / Phase 4
 */
import { execSync } from 'node:child_process';

import {
  clear2faStateForUser,
  clearMaildev,
  extractCookieValue,
  fetchLatest2faCode,
} from './helpers.js';

// Integration test: response shapes are validated by assertions, not static types.

type JsonBody = Record<string, any>;

const BASE_URL = 'http://localhost:3000/api/v2';
const APITEST_EMAIL = 'info@assixx.com';
const APITEST_PASSWORD = 'ApiTest12345!';
/** Apitest tenant root user id — verified via psql probe 2026-04-29. */
const APITEST_USER_ID = 1;

// Shared state across sequential describe blocks
let authToken = '';
let refreshToken = '';
let _userId: number;
let _tenantId: number;

/**
 * Enable all purchasable addons and set team lead for the test tenant.
 * Required for KVP tests (team lead) and addon-gated endpoints (ADR-033).
 * Runs via docker exec — safe because auth tokens are in-process, not Redis.
 */
function applyDbPrerequisites(tenantId: number, userId: number): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "
      -- Enable all purchasable addons for the test tenant (ADR-033)
      INSERT INTO tenant_addons (tenant_id, addon_id, status, activated_at, is_active, created_at, updated_at)
      SELECT ${tenantId}, id, 'active', NOW(), 1, NOW(), NOW()
      FROM addons WHERE is_active = 1 AND is_core = false
      ON CONFLICT (tenant_id, addon_id) DO UPDATE SET status = 'active', is_active = 1, deactivated_at = NULL, updated_at = NOW();

      -- Ensure a verified primary tenant_domain exists (feat: add tenant domain as subdomain).
      -- Backend rejects POST /users + POST /dummy-users with 403 if the tenant has no
      -- verified domain. For the apitest tenant, DNS-based verification is not reproducible
      -- in Docker/CI, so we mark assixx.com as verified directly. ON CONFLICT DO NOTHING
      -- makes this idempotent against all three partial-unique indexes on tenant_domains
      -- (tenant_domains_one_primary_per_tenant, tenant_domains_tenant_domain_unique,
      -- idx_tenant_domains_domain_verified) — any of them matching a live row is a
      -- no-op. Also repair a soft-deleted primary so the next test run finds a verified
      -- row (otherwise 403 on user-create returns).
      INSERT INTO tenant_domains (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
      VALUES (${tenantId}, 'assixx.com', 'verified',
              substr(md5(random()::text) || md5(random()::text), 1, 64),
              NOW(), true, 1)
      ON CONFLICT DO NOTHING;

      UPDATE tenant_domains
      SET is_active = 1, status = 'verified', verified_at = COALESCE(verified_at, NOW()), is_primary = true
      WHERE tenant_id = ${tenantId}
        AND domain = 'assixx.com'
        AND NOT (is_active = 1 AND is_primary = true AND status = 'verified');

      -- Ensure a department exists (required FK for teams)
      INSERT INTO departments (tenant_id, name, description, is_active, uuid, uuid_created_at)
      SELECT ${tenantId}, 'Test Department', 'Auto-created for API tests', 1, gen_random_uuid()::char(36), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE tenant_id = ${tenantId});

      -- Ensure user has team_lead position (required by validate_team_lead_position trigger)
      UPDATE users SET position = 'team_lead' WHERE id = ${userId} AND (position IS NULL OR position != 'team_lead');

      -- Ensure a team exists (required for KVP team_lead)
      INSERT INTO teams (tenant_id, name, department_id, team_lead_id, is_active, uuid, uuid_created_at)
      SELECT ${tenantId}, 'Test Team',
        (SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1),
        ${userId}, 1, gen_random_uuid()::char(36), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM teams WHERE tenant_id = ${tenantId});

      -- Set team_lead on any team that lacks one
      UPDATE teams SET team_lead_id = ${userId}
      WHERE id = (
        SELECT id FROM teams WHERE tenant_id = ${tenantId} AND team_lead_id IS NULL LIMIT 1
      );
    "`,
    { stdio: 'pipe' },
  );
}

/** Flush throttle/rate-limit keys from Redis — prevents 429 on repeated test runs. */
function flushThrottleKeys(): void {
  execSync(
    "docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning EVAL \"local keys = redis.call('KEYS', 'throttle:*') for i, key in ipairs(keys) do redis.call('DEL', key) end return #keys\" 0",
    { stdio: 'pipe' },
  );
}

/**
 * Step 1: POST /auth/login with 429 retry. Returns the raw response so
 * `Auth: Step 1` assertions can inspect the discriminated-union body
 * (`stage: 'challenge_required'`) and the `challengeToken` cookie directly.
 */
async function performLoginStep(): Promise<{ res: Response; body: JsonBody }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: APITEST_EMAIL,
        password: APITEST_PASSWORD,
      }),
    });

    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      continue;
    }

    const body = (await res.json()) as JsonBody;
    return { res, body };
  }

  throw new Error('Login failed after 3 retries (429)');
}

/**
 * Step 2: POST /auth/2fa/verify with the challenge cookie + the code parsed
 * from Maildev. Returns the raw response so `Auth: Step 2` assertions can
 * inspect the body (`stage: 'authenticated'`, `user`) and the
 * accessToken/refreshToken cookies issued by `setAuthCookies`.
 */
async function performVerifyStep(
  challengeToken: string,
  code: string,
): Promise<{ res: Response; body: JsonBody }> {
  const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
    },
    body: JSON.stringify({ code }),
  });
  const body = (await res.json()) as JsonBody;
  return { res, body };
}

/**
 * Composite helper: run BOTH steps end-to-end against `info@assixx.com`. Used
 * by `it()` blocks that just need authenticated state (logout, re-login).
 *
 * Pre-cleans Redis 2FA state and Maildev so failed prior runs cannot poison
 * the lockout/fail-streak counters or leave stale codes in the inbox.
 */
async function loginAndVerify(): Promise<{
  loginRes: Response;
  loginBody: JsonBody;
  verifyRes: Response;
  verifyBody: JsonBody;
  challengeToken: string;
  accessToken: string;
  refreshTokenValue: string;
}> {
  clear2faStateForUser(APITEST_USER_ID);
  await clearMaildev();

  const { res: loginRes, body: loginBody } = await performLoginStep();
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`Unexpected login stage: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error('challengeToken cookie missing from /auth/login response');
  }

  const code = await fetchLatest2faCode(APITEST_EMAIL);
  const { res: verifyRes, body: verifyBody } = await performVerifyStep(challengeToken, code);
  const setCookies = verifyRes.headers.getSetCookie();
  const accessToken = extractCookieValue(setCookies, 'accessToken') ?? '';
  const refreshTokenValue = extractCookieValue(setCookies, 'refreshToken') ?? '';

  return {
    loginRes,
    loginBody,
    verifyRes,
    verifyBody,
    challengeToken,
    accessToken,
    refreshTokenValue,
  };
}

// ─── Setup: Ensure apitest tenant exists and login ─────────────────────────

describe('Setup: Apitest Tenant', () => {
  // Flush rate-limit keys to prevent 429 from previous test runs
  beforeAll(() => flushThrottleKeys());

  it('should check subdomain availability', async () => {
    const res = await fetch(`${BASE_URL}/signup/check-subdomain/assixx`);
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('available');
    expect(body.data).toHaveProperty('subdomain');
    expect(body.data.subdomain).toBe('assixx');
  });

  it('should create tenant or confirm it already exists', async () => {
    // Pre-clean Maildev so any signup-challenge mail this test produces is
    // unambiguous (DB might be fresh, in which case this signup is the FIRST
    // event and produces a `purpose=signup` 2FA mail — we MUST verify it,
    // otherwise the user stays at is_active=INACTIVE per Step 2.5 and every
    // subsequent test in the suite logs in as an inactive user → 403).
    await clearMaildev();

    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'API Test GmbH',
        subdomain: 'assixx',
        email: 'info@assixx.com',
        phone: '+49123456789',
        street: 'Musterstraße',
        houseNumber: '42',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
        adminEmail: APITEST_EMAIL,
        adminPassword: APITEST_PASSWORD,
        adminFirstName: 'John',
        adminLastName: 'Doe',
        plan: 'trial',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // 201 = fresh signup (tenant + user created at is_active=INACTIVE,
    //        body carries `stage: 'challenge_required'` per Step 2.5).
    // 409 = subdomain or admin email already taken (subsequent runs).
    expect([201, 409]).toContain(res.status);
    expect(body).toBeDefined();

    if (res.status === 201) {
      // Fresh-DB bootstrap: signup-Step issues a 2FA challenge for the new
      // root user. We must complete the verify or the apitest tenant root
      // sits at is_active=INACTIVE and breaks every downstream test.
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: 201 branch is the fresh-DB bootstrap path; 409 just confirms the tenant exists
      expect(body.data.stage).toBe('challenge_required');

      const challengeToken = extractCookieValue(res.headers.getSetCookie(), 'challengeToken');
      // eslint-disable-next-line vitest/no-conditional-expect -- 201 only
      expect(challengeToken).not.toBeNull();
      const code = await fetchLatest2faCode(APITEST_EMAIL);
      // challengeToken non-null established by the assertion above
      const { res: verifyRes, body: verifyBody } = await performVerifyStep(
        challengeToken as string,
        code,
      );
      // eslint-disable-next-line vitest/no-conditional-expect -- 201 only
      expect(verifyRes.status).toBe(200);
      // eslint-disable-next-line vitest/no-conditional-expect -- 201 only
      expect(verifyBody.data.stage).toBe('authenticated');
    }
  });

  it('should login + 2FA verify as apitest admin', async () => {
    const { loginRes, loginBody, verifyRes, verifyBody, accessToken, refreshTokenValue } =
      await loginAndVerify();

    // Step 1 contract — discriminated union, no tokens in body (R8).
    expect(loginRes.status).toBe(200);
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.stage).toBe('challenge_required');
    expect(loginBody.data.challenge).toBeTypeOf('object');
    expect(loginBody.data.challenge.expiresAt).toBeTypeOf('string');
    expect(loginBody.data.challenge.resendAvailableAt).toBeTypeOf('string');
    expect(loginBody.data.challenge.resendsRemaining).toBe(3);
    // Cookie carries the challenge token, body deliberately does NOT (DD-4 / R8).
    expect(loginBody.data).not.toHaveProperty('accessToken');
    expect(loginBody.data).not.toHaveProperty('refreshToken');

    // Step 2 contract — tokens issued via Set-Cookie, user shape in body.
    expect(verifyRes.status).toBe(200);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.stage).toBe('authenticated');
    expect(verifyBody.data.user.id).toBeTypeOf('number');
    expect(verifyBody.data.user.email).toBe(APITEST_EMAIL);
    expect(verifyBody.data.user).toHaveProperty('role');
    expect(verifyBody.data).not.toHaveProperty('accessToken');
    expect(verifyBody.data).not.toHaveProperty('refreshToken');
    expect(accessToken.length).toBeGreaterThan(20);
    expect(refreshTokenValue.length).toBeGreaterThan(20);

    // Store for subsequent tests
    authToken = accessToken;
    refreshToken = refreshTokenValue;
    _userId = verifyBody.data.user.id as number;
    _tenantId = verifyBody.data.user.tenantId as number;

    // Enable addons + set team lead (idempotent, runs every time)
    applyDbPrerequisites(_tenantId, _userId);
  });
});

// ─── Auth: Step 1 — Challenge issuance (POST /auth/login) ────────────────────

describe('Auth: Step 1 — POST /auth/login → challenge', () => {
  let loginRes: Response;
  let loginBody: JsonBody;
  let setCookies: string[];

  beforeAll(async () => {
    // Pre-clean lockout/fail-streak for the test root so a poisoned prior run
    // can't blow this test up with a 403 instead of the expected 200/challenge.
    clear2faStateForUser(APITEST_USER_ID);
    await clearMaildev();
    const result = await performLoginStep();
    loginRes = result.res;
    loginBody = result.body;
    setCookies = loginRes.headers.getSetCookie();
  });

  it('should return 200 OK with success envelope', () => {
    expect(loginRes.status).toBe(200);
    expect(loginBody.success).toBe(true);
  });

  it('should return stage=challenge_required (no tokens in body, R8)', () => {
    expect(loginBody.data.stage).toBe('challenge_required');
    expect(loginBody.data).not.toHaveProperty('accessToken');
    expect(loginBody.data).not.toHaveProperty('refreshToken');
    expect(loginBody.data).not.toHaveProperty('user');
  });

  it('should return challenge metadata with valid timestamps + DD-21 resend cap', () => {
    expect(loginBody.data.challenge).toBeTypeOf('object');
    expect(loginBody.data.challenge.expiresAt).toBeTypeOf('string');
    expect(loginBody.data.challenge.resendAvailableAt).toBeTypeOf('string');
    expect(loginBody.data.challenge.resendsRemaining).toBe(3);
    // Both timestamps must be parseable ISO 8601
    expect(Number.isFinite(Date.parse(loginBody.data.challenge.expiresAt as string))).toBe(true);
    expect(Number.isFinite(Date.parse(loginBody.data.challenge.resendAvailableAt as string))).toBe(
      true,
    );
  });

  it('should set httpOnly challengeToken cookie (cookie = single source of truth)', () => {
    const challengeToken = extractCookieValue(setCookies, 'challengeToken');
    expect(challengeToken).not.toBeNull();
    expect((challengeToken ?? '').length).toBeGreaterThan(20);
    // Cookie must carry httpOnly attribute — never accessible to JS (R8)
    const cookieLine = setCookies.find((c) => c.startsWith('challengeToken='));
    expect(cookieLine).toBeDefined();
    expect((cookieLine ?? '').toLowerCase()).toContain('httponly');
    expect((cookieLine ?? '').toLowerCase()).toContain('samesite=lax');
  });
});

// ─── Auth: Step 2 — 2FA verify (POST /auth/2fa/verify) ───────────────────────

describe('Auth: Step 2 — POST /auth/2fa/verify → tokens', () => {
  let verifyRes: Response;
  let verifyBody: JsonBody;
  let setCookies: string[];

  beforeAll(async () => {
    // Run a fresh login → maildev → verify cycle so the assertions below
    // exercise live cookies (the prior block consumed the previous challenge).
    const result = await loginAndVerify();
    verifyRes = result.verifyRes;
    verifyBody = result.verifyBody;
    setCookies = verifyRes.headers.getSetCookie();

    // Update shared state for downstream describe blocks
    authToken = result.accessToken;
    refreshToken = result.refreshTokenValue;
    _userId = verifyBody.data.user.id as number;
    _tenantId = verifyBody.data.user.tenantId as number;
  });

  it('should return 200 OK + stage=authenticated', () => {
    expect(verifyRes.status).toBe(200);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.stage).toBe('authenticated');
  });

  it('should return user data in body', () => {
    expect(verifyBody.data).toHaveProperty('user');
    expect(verifyBody.data.user).toHaveProperty('id');
    expect(verifyBody.data.user.email).toBe(APITEST_EMAIL);
    expect(verifyBody.data.user).toHaveProperty('role');
    expect(verifyBody.data.user).toHaveProperty('tenantId');
  });

  it('should issue access + refresh tokens via Set-Cookie (NOT body, R8)', () => {
    expect(verifyBody.data).not.toHaveProperty('accessToken');
    expect(verifyBody.data).not.toHaveProperty('refreshToken');
    const accessToken = extractCookieValue(setCookies, 'accessToken');
    const refreshTokenCookie = extractCookieValue(setCookies, 'refreshToken');
    expect(accessToken).not.toBeNull();
    expect(refreshTokenCookie).not.toBeNull();
    expect((accessToken ?? '').length).toBeGreaterThan(20);
    expect((refreshTokenCookie ?? '').length).toBeGreaterThan(20);
  });

  it('should clear the challengeToken cookie after successful verify', () => {
    // setAuthCookies wipes challengeToken via Max-Age=0; getSetCookie() lists
    // it as `challengeToken=; Max-Age=0; ...` which extractCookieValue
    // correctly reports as null (empty value treated as absent).
    const cleared = extractCookieValue(setCookies, 'challengeToken');
    expect(cleared).toBeNull();
  });
});

// ─── Auth: Refresh Token ─────────────────────────────────────────────────────

describe('Auth: Refresh Token', () => {
  it('should return 200 OK with new tokens', async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');

    // Token rotation: update with new tokens
    authToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
  });
});

// ─── Auth: Logout ────────────────────────────────────────────────────────────

describe('Auth: Logout', () => {
  it('should return 200 OK and revoke tokens', async () => {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('tokensRevoked');
  });

  it('should re-login + 2FA verify after logout to keep state for subsequent tests', async () => {
    const result = await loginAndVerify();

    expect(result.loginRes.status).toBe(200);
    expect(result.verifyRes.status).toBe(200);
    expect(result.verifyBody.data.stage).toBe('authenticated');

    // Restore shared state
    authToken = result.accessToken;
    refreshToken = result.refreshTokenValue;
    _userId = result.verifyBody.data.user.id as number;
    _tenantId = result.verifyBody.data.user.tenantId as number;
  });
});

// ─── Setup: Persistent Fixture Users (alphabetic-order safe) ─────────────────
//
// WHY: Several test files (auth-forgot-password, security-settings,
// tenant-domains) and the kvp `/options caps users at 50` test need persistent
// users that exist before they run. Vitest's API project (`pool: 'forks',
// maxWorkers: 1, isolate: false`) executes files alphabetically, so anything
// created here (file 00-*) is reliably present in every later file.
//
// Persistence is by design: global-teardown.ts intentionally does NOT
// hard-delete role=admin/employee users (30 RESTRICT FKs into users — see
// teardown NOTE for context). These fixtures accumulate harmlessly across
// runs because the email is stable (no timestamp) — POST /users returns 409
// on the second run, which we treat as success.
//
// Two concerns covered:
//   1. `perm-test-admin@assixx.com` (admin role) — login fixture for the 3
//      tests above (auth-forgot-password, security-settings, tenant-domains).
//      admin-permissions.api.test.ts also creates this user, but file order
//      vs. alphabetic-vs-discovery is not guaranteed in vitest, so 00-* is
//      the safe place.
//   2. `kvp-fixture-NNN@assixx.com` (50 users, employee role) — needed for
//      `GET /kvp/participants/options` to actually exercise the 50-row LIMIT
//      cap. With <50 users in the tenant, the test asserts on a no-op cap.
//
// First-run cost: ~50 POST /users requests. Subsequent runs: ~50 cheap 409s.
// Idempotency is enforced by the 'kvp-fixture-NNN' naming pattern (no
// timestamp), so existing rows don't multiply.
//
// @see backend/test/global-teardown.ts NOTE about user accumulation
// @see backend/test/kvp.api.test.ts test #11 (`/options caps users at 50`)

const FIXTURE_ADMIN_EMAIL = 'perm-test-admin@assixx.com';
const KVP_FIXTURE_USER_COUNT = 50;
const KVP_FIXTURE_PREFIX = 'kvp-fixture-';

async function fetchPositionId(token: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/organigram/positions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as JsonBody;
  const positions = body.data as Array<{ id: string; roleCategory: string }>;
  const employeePos = positions.find((p) => p.roleCategory === 'employee');
  if (!employeePos) throw new Error('No employee position in catalog');
  return employeePos.id;
}

async function createUserIfMissing(
  token: string,
  payload: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'employee';
    positionId: string;
  },
): Promise<void> {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email: payload.email,
      password: APITEST_PASSWORD,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      phone: '+49123456000',
      positionIds: [payload.positionId],
    }),
  });
  // 201 = created, 409 = already exists. Both are success for this fixture.
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Fixture user create failed for ${payload.email}: ${String(res.status)}`);
  }
}

describe('Setup: Persistent Fixture Users', () => {
  it('should ensure perm-test-admin + 50 kvp-fixture users exist for downstream tests', async () => {
    const positionId = await fetchPositionId(authToken);

    // 1. Persistent admin used by 3 tests (auth-forgot-password,
    //    security-settings, tenant-domains).
    await createUserIfMissing(authToken, {
      email: FIXTURE_ADMIN_EMAIL,
      firstName: 'PermTest',
      lastName: 'Admin',
      role: 'admin',
      positionId,
    });

    // 2. 50 employees needed by kvp test #11 (`/options caps users at 50`).
    //    Guarantees the LIMIT cap actually triggers on a fresh DB.
    for (let i = 0; i < KVP_FIXTURE_USER_COUNT; i++) {
      await createUserIfMissing(authToken, {
        email: `${KVP_FIXTURE_PREFIX}${String(i).padStart(3, '0')}@assixx.com`,
        firstName: 'KvpFixture',
        lastName: String(i).padStart(3, '0'),
        role: 'employee',
        positionId,
      });
    }

    // Verify the seed actually landed: re-running createUserIfMissing for the
    // admin must produce 409 (already exists). Catches silent regressions
    // where POST /users returned 201 but the row never persisted.
    // Avoids GET /users?limit=200 — the endpoint enforces limit<=100, and
    // pagination would add complexity for no functional gain here.
    const reverifyRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        email: FIXTURE_ADMIN_EMAIL,
        password: APITEST_PASSWORD,
        firstName: 'PermTest',
        lastName: 'Admin',
        role: 'admin',
        phone: '+49123456000',
        positionIds: [positionId],
      }),
    });
    expect(reverifyRes.status).toBe(409);
  }, 60_000); // runs short-circuit on 409 in <2s. // First run takes ~50× POST + retries. 60s gives generous headroom; later
});
