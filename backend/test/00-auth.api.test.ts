/**
 * Auth API Integration Tests
 *
 * Runs against the REAL backend (Docker must be running).
 * Uses native fetch() -- no mocking, no HTTP client libraries.
 *
 * NOTE: This file does NOT use helpers.ts loginApitest() because it
 * tests the login endpoint directly. Other test files use the cached helper.
 *
 * @see vitest.config.ts (project: api)
 */
import { execSync } from 'node:child_process';

// Integration test: response shapes are validated by assertions, not static types.

type JsonBody = Record<string, any>;

const BASE_URL = 'http://localhost:3000/api/v2';
const APITEST_EMAIL = 'admin@apitest.de';
const APITEST_PASSWORD = 'ApiTest12345!';

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
      -- in Docker/CI, so we mark apitest.de as verified directly. ON CONFLICT DO NOTHING
      -- makes this idempotent against all three partial-unique indexes on tenant_domains
      -- (tenant_domains_one_primary_per_tenant, tenant_domains_tenant_domain_unique,
      -- idx_tenant_domains_domain_verified) — any of them matching a live row is a
      -- no-op. Also repair a soft-deleted primary so the next test run finds a verified
      -- row (otherwise 403 on user-create returns).
      INSERT INTO tenant_domains (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
      VALUES (${tenantId}, 'apitest.de', 'verified',
              substr(md5(random()::text) || md5(random()::text), 1, 64),
              NOW(), true, 1)
      ON CONFLICT DO NOTHING;

      UPDATE tenant_domains
      SET is_active = 1, status = 'verified', verified_at = COALESCE(verified_at, NOW()), is_primary = true
      WHERE tenant_id = ${tenantId}
        AND domain = 'apitest.de'
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

/** Login with 429 retry for rate-limited environments. */
async function login(): Promise<{ res: Response; body: JsonBody }> {
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

// ─── Setup: Ensure apitest tenant exists and login ─────────────────────────

describe('Setup: Apitest Tenant', () => {
  // Flush rate-limit keys to prevent 429 from previous test runs
  beforeAll(() => flushThrottleKeys());

  it('should check subdomain availability', async () => {
    const res = await fetch(`${BASE_URL}/signup/check-subdomain/apitest`);
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('available');
    expect(body.data).toHaveProperty('subdomain');
    expect(body.data.subdomain).toBe('apitest');
  });

  it('should create tenant or confirm it already exists', async () => {
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'API Test GmbH',
        subdomain: 'apitest',
        email: 'info@apitest.de',
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

    // 201 = created, 409 = already exists -- both are fine
    expect([201, 409]).toContain(res.status);
    expect(body).toBeDefined();

    // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: response shape differs by HTTP status (201 vs 409)
    if (res.status === 201) expect(body.data.subdomain).toBe('apitest');
  });

  it('should login as apitest admin', async () => {
    const { res, body } = await login();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTypeOf('string');
    expect(body.data.refreshToken).toBeTypeOf('string');
    expect(body.data.user.id).toBeTypeOf('number');
    expect(body.data.user.email).toBe(APITEST_EMAIL);
    expect(body.data.user).toHaveProperty('role');

    // Store for subsequent tests
    authToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
    _userId = body.data.user.id;
    _tenantId = body.data.user.tenantId;

    // Enable addons + set team lead (idempotent, runs every time)
    applyDbPrerequisites(_tenantId, _userId);
  });
});

// ─── Auth: Login (single request, multiple assertions) ───────────────────────

describe('Auth: Login', () => {
  let loginRes: Response;
  let loginBody: JsonBody;

  beforeAll(async () => {
    const result = await login();
    loginRes = result.res;
    loginBody = result.body;

    // Update shared state
    authToken = loginBody.data.accessToken;
    refreshToken = loginBody.data.refreshToken;
    _userId = loginBody.data.user.id;
    _tenantId = loginBody.data.user.tenantId;
  });

  it('should return 200 OK', () => {
    expect(loginRes.status).toBe(200);
    expect(loginBody.success).toBe(true);
  });

  it('should return access and refresh tokens', () => {
    expect(loginBody.data).toHaveProperty('accessToken');
    expect(loginBody.data.accessToken).toBeTypeOf('string');
    expect(loginBody.data).toHaveProperty('refreshToken');
    expect(loginBody.data.refreshToken).toBeTypeOf('string');
  });

  it('should return user data', () => {
    expect(loginBody.data).toHaveProperty('user');
    expect(loginBody.data.user).toHaveProperty('id');
    expect(loginBody.data.user).toHaveProperty('email');
    expect(loginBody.data.user).toHaveProperty('role');
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

  it('should re-login after logout to keep state for potential subsequent tests', async () => {
    const { res, body } = await login();

    expect(res.status).toBe(200);

    // Restore shared state
    authToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
    _userId = body.data.user.id;
    _tenantId = body.data.user.tenantId;
  });
});
