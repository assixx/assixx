/**
 * Dummy Users API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests: Auth, CRUD, Dummy Login & Access Control, Query Isolation.
 *
 * @see vitest.config.api.ts
 */
import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  ensureTestEmployee,
  fetchWithRetry,
  flushThrottleKeys,
  loginApitest,
} from './helpers.js';

let adminAuth: AuthState;

/** UUID of dummy created in CRUD tests */
let dummyUuid: string;
/** Auto-generated email of the created dummy */
let dummyEmail: string;

/** UUID of a second dummy for login/access tests (not soft-deleted) */
let accessDummyUuid: string;
let accessDummyEmail: string;
let accessDummyAuth: AuthState;

const DUMMY_PASSWORD = 'DummyPasswort123!';

beforeAll(async () => {
  adminAuth = await loginApitest();
});

// Clean up dummy users after all tests
afterAll(async () => {
  const uuids = [dummyUuid, accessDummyUuid].filter(Boolean);
  for (const uuid of uuids) {
    await fetch(`${BASE_URL}/dummy-users/${uuid}`, {
      method: 'DELETE',
      headers: authOnly(adminAuth.authToken),
    });
  }
});

// ---- seq: 1 -- Auth: Unauthenticated → 401 ---------------------------------

describe('Dummy Users: Auth', () => {
  it('should return 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for employee role', async () => {
    await ensureTestEmployee(adminAuth.authToken);

    // Login as employee
    const loginRes = await fetchWithRetry(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee@apitest.de',
        password: APITEST_PASSWORD,
      }),
    });
    expect(loginRes.ok).toBe(true);

    const loginBody = (await loginRes.json()) as JsonBody;
    const employeeToken = loginBody.data.accessToken as string;

    const res = await fetch(`${BASE_URL}/dummy-users`, {
      headers: authOnly(employeeToken),
    });
    expect(res.status).toBe(403);
  });
});

// ---- seq: 2 -- CRUD: Create Dummy -------------------------------------------

describe('Dummy Users: Create', () => {
  it('should return 201 with auto-generated email', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({
        displayName: `API Test Dummy ${Date.now()}`,
        password: DUMMY_PASSWORD,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.email).toMatch(/^dummy_\d+@.*\.display$/);
    expect(body.data.employeeNumber).toMatch(/^DUMMY-\d{3,}$/);
    expect(body.data.uuid).toBeDefined();

    dummyUuid = body.data.uuid as string;
    dummyEmail = body.data.email as string;
  });

  it('should return 400 for missing displayName', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({ password: DUMMY_PASSWORD }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for too short password', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({ displayName: 'Test', password: 'short' }),
    });

    expect(res.status).toBe(400);
  });
});

// ---- seq: 3 -- CRUD: List Dummies -------------------------------------------

describe('Dummy Users: List', () => {
  it('should return 200 with items array', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('should only contain dummy users, not employees', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    const items = body.data.items as Array<{ email: string }>;

    for (const item of items) {
      expect(item.email).toMatch(/dummy/i);
    }
  });
});

// ---- seq: 4 -- CRUD: Get Single Dummy ---------------------------------------

describe('Dummy Users: Get Single', () => {
  it('should return 200 with dummy details', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users/${dummyUuid}`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.uuid).toBe(dummyUuid);
    expect(body.data.email).toBe(dummyEmail);
    expect(body.data.displayName).toBeDefined();
  });
});

// ---- seq: 5 -- CRUD: Update Dummy -------------------------------------------

describe('Dummy Users: Update', () => {
  it('should return 200 with updated displayName', async () => {
    const newName = `Updated Dummy ${Date.now()}`;
    const res = await fetch(`${BASE_URL}/dummy-users/${dummyUuid}`, {
      method: 'PUT',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({ displayName: newName }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.displayName).toBe(newName);
  });
});

// ---- seq: 6 -- CRUD: Delete Dummy -------------------------------------------

describe('Dummy Users: Delete', () => {
  it('should return 200 on soft-delete', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users/${dummyUuid}`, {
      method: 'DELETE',
      headers: authOnly(adminAuth.authToken),
    });

    expect(res.status).toBe(200);
  });

  it('should return 404 after delete', async () => {
    const res = await fetch(`${BASE_URL}/dummy-users/${dummyUuid}`, {
      headers: authOnly(adminAuth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

// ---- seq: 7 -- Dummy Login & Access Control ---------------------------------

describe('Dummy Users: Login & Access', () => {
  // Create a fresh dummy for login tests (the CRUD one was deleted)
  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/dummy-users`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({
        displayName: `Access Test Dummy ${Date.now()}`,
        password: DUMMY_PASSWORD,
      }),
    });
    const body = (await res.json()) as JsonBody;
    accessDummyUuid = body.data.uuid as string;
    accessDummyEmail = body.data.email as string;

    // Flush throttle keys to prevent 429 from accumulated login requests
    await flushThrottleKeys();

    // Login as the dummy user
    const loginRes = await fetchWithRetry(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: accessDummyEmail,
        password: DUMMY_PASSWORD,
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`Dummy login failed with status ${loginRes.status}`);
    }
    const loginBody = (await loginRes.json()) as JsonBody;

    accessDummyAuth = {
      authToken: loginBody.data.accessToken as string,
      refreshToken: loginBody.data.refreshToken as string,
      userId: loginBody.data.user.id as number,
      tenantId: loginBody.data.user.tenantId as number,
    };
  });

  // --- Allowed endpoints (auto-assigned read-only permissions) ---

  it('should allow dummy GET /blackboard/entries', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      headers: authOnly(accessDummyAuth.authToken),
    });
    expect(res.status).toBe(200);
  });

  it('should allow dummy GET /calendar/events', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      headers: authOnly(accessDummyAuth.authToken),
    });
    expect(res.status).toBe(200);
  });

  it('should allow dummy GET /tpm/plans', async () => {
    const res = await fetch(`${BASE_URL}/tpm/plans`, {
      headers: authOnly(accessDummyAuth.authToken),
    });
    expect(res.status).toBe(200);
  });

  // --- Denied endpoints ---

  it('should deny dummy POST /blackboard/entries (canWrite=false)', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      method: 'POST',
      headers: authHeaders(accessDummyAuth.authToken),
      body: JSON.stringify({
        title: 'Dummy should not create',
        content: 'This should fail',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('should deny dummy POST /calendar/events (canWrite=false)', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      method: 'POST',
      headers: authHeaders(accessDummyAuth.authToken),
      body: JSON.stringify({
        title: 'Dummy should not create events',
        startTime: '2026-04-01T09:00:00',
        endTime: '2026-04-01T10:00:00',
        orgLevel: 'personal',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('should deny dummy GET /chat/conversations (no chat permission)', async () => {
    const res = await fetch(`${BASE_URL}/chat/conversations`, {
      headers: authOnly(accessDummyAuth.authToken),
    });
    expect(res.status).toBe(403);
  });

  it('should return 200 with scope-filtered data for dummy GET /users (no @RequirePermission on GET)', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: authOnly(accessDummyAuth.authToken),
    });
    expect(res.status).toBe(200);
  });
});

// ---- seq: 8 -- Query Isolation (Regression) ---------------------------------

describe('Dummy Users: Query Isolation', () => {
  it('should NOT show dummies in GET /users', async () => {
    const res = await fetch(`${BASE_URL}/users?limit=100`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const users = body.data as Array<{ role: string }>;
    const dummies = users.filter((u: { role: string }) => u.role === 'dummy');
    expect(dummies).toHaveLength(0);
  });
});
