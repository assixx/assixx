/**
 * Auth API Integration Tests
 *
 * Migrated from Bruno CLI tests:
 *   _setup/01-check-subdomain.bru
 *   _setup/02-create-tenant.bru
 *   _setup/03-login-brunotest.bru
 *   auth/login.bru
 *   auth/refresh.bru
 *   auth/logout.bru
 *
 * Runs against the REAL backend (Docker must be running).
 * Uses native fetch() -- no mocking, no HTTP client libraries.
 *
 * NOTE: This file does NOT use helpers.ts loginBrunotest() because it
 * tests the login endpoint directly. Other test files use the cached helper.
 *
 * @see vitest.config.ts (project: api)
 */

// Integration test: response shapes are validated by assertions, not static types.
 
type JsonBody = Record<string, any>;

const BASE_URL = 'http://localhost:3000/api/v2';
const BRUNOTEST_EMAIL = 'admin@brunotest.de';
const BRUNOTEST_PASSWORD = 'BrunoTest123!';

// Shared state across sequential tests (replaces Bruno's bru.setVar)
let authToken = '';
let refreshToken = '';
let _userId: number;
let _tenantId: number;

/** Login with 429 retry for rate-limited environments. */
async function login(): Promise<{ res: Response; body: JsonBody }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: BRUNOTEST_EMAIL,
        password: BRUNOTEST_PASSWORD,
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

// ─── Setup: Ensure brunotest tenant exists and login ─────────────────────────

describe('Setup: Brunotest Tenant', () => {
  it('should check subdomain availability', async () => {
    const res = await fetch(`${BASE_URL}/signup/check-subdomain/brunotest`);
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('available');
    expect(body.data).toHaveProperty('subdomain');
    expect(body.data.subdomain).toBe('brunotest');
  });

  it('should create tenant or confirm it already exists', async () => {
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Bruno Test GmbH',
        subdomain: 'brunotest',
        email: 'info@brunotest.de',
        phone: '+49 123 456789',
        address: 'Teststrasse 1, 12345 Teststadt',
        adminEmail: BRUNOTEST_EMAIL,
        adminPassword: BRUNOTEST_PASSWORD,
        adminFirstName: 'Bruno',
        adminLastName: 'Tester',
        plan: 'trial',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // 201 = created, 409 = already exists -- both are fine
    expect([201, 409]).toContain(res.status);
    expect(body).toBeDefined();

    // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: response shape differs by HTTP status (201 vs 409)
    if (res.status === 201) expect(body.data.subdomain).toBe('brunotest');
  });

  it('should login as brunotest admin', async () => {
    const { res, body } = await login();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTypeOf('string');
    expect(body.data.refreshToken).toBeTypeOf('string');
    expect(body.data.user.id).toBeTypeOf('number');
    expect(body.data.user.email).toBe(BRUNOTEST_EMAIL);
    expect(body.data.user).toHaveProperty('role');

    // Store for subsequent tests
    authToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
    _userId = body.data.user.id;
    _tenantId = body.data.user.tenantId;
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
