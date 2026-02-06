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
 * Enable all features and set team lead for the test tenant.
 * Required for KVP tests (team lead) and feature-gated endpoints.
 * Runs via docker exec — safe because auth tokens are in-process, not Redis.
 */
function applyDbPrerequisites(tenantId: number, userId: number): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "
      -- Enable all features for the test tenant
      INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at)
      SELECT ${tenantId}, id, 1, NOW() FROM features WHERE is_active = 1
      ON CONFLICT (tenant_id, feature_id) DO UPDATE SET is_active = 1;

      -- Ensure a department exists (required FK for teams)
      INSERT INTO departments (tenant_id, name, description, is_active, uuid, uuid_created_at)
      SELECT ${tenantId}, 'Test Department', 'Auto-created for API tests', 1, gen_random_uuid()::char(36), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE tenant_id = ${tenantId});

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
        phone: '+49 123 456789',
        address: 'Teststrasse 1, 12345 Teststadt',
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

    // Enable features + set team lead (idempotent, runs every time)
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
