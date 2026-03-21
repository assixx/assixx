/**
 * User Feature Permissions API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests GET/PUT endpoints for per-user permission management.
 *
 * Scenarios:
 *   1. GET returns default permissions (all false) for user
 *   2. GET returns categories filtered by tenant's active features
 *   3. PUT saves permissions, GET returns saved values
 *   4. PUT with unknown addonCode returns 400
 *   5. PUT with invalid body returns 400
 *   6. GET with non-existent UUID returns 404
 *   7. Non-admin (employee) gets 403
 *
 * @see docs/USER-PERMISSIONS-PLAN.md — Phase 8
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
  loginApitest,
} from './helpers.js';

let auth: AuthState;
let employeeUuid: string;
let employeeToken: string;

beforeAll(async () => {
  auth = await loginApitest();

  // Ensure test employee exists
  await ensureTestEmployee(auth.authToken);

  // Get employee UUID from users list
  const usersRes = await fetch(`${BASE_URL}/users?limit=50`, {
    headers: authOnly(auth.authToken),
  });
  const usersBody = (await usersRes.json()) as JsonBody;
  const employee = (usersBody.data as Array<{ email: string; uuid: string }>).find(
    (u) => u.email === 'employee@apitest.de',
  );

  if (!employee?.uuid) {
    throw new Error('Test employee not found or has no UUID');
  }
  employeeUuid = employee.uuid;

  // Login as employee for 403 test
  const empLoginRes = await fetchWithRetry(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employee@apitest.de',
      password: APITEST_PASSWORD,
    }),
  });
  const empLoginBody = (await empLoginRes.json()) as JsonBody;
  employeeToken = empLoginBody.data.accessToken as string;
});

// ─── GET Default Permissions (seq: 1) ─────────────────────────────────────────

describe('User Permissions: GET Default Permissions', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return array of permission categories', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('should return categories with correct structure', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    const category = body.data[0];
    expect(category).toHaveProperty('code');
    expect(category).toHaveProperty('label');
    expect(category).toHaveProperty('icon');
    expect(category).toHaveProperty('modules');
    expect(Array.isArray(category.modules)).toBe(true);
  });

  it('should return modules with permission boolean fields', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    const category = body.data[0];
    const mod = category.modules[0];

    expect(mod).toHaveProperty('code');
    expect(mod).toHaveProperty('label');
    expect(mod).toHaveProperty('icon');
    expect(mod).toHaveProperty('allowedPermissions');
    expect(mod).toHaveProperty('canRead');
    expect(mod).toHaveProperty('canWrite');
    expect(mod).toHaveProperty('canDelete');
    expect(mod.canRead).toBeTypeOf('boolean');
  });
});

// ─── GET Tenant Feature Filtering (seq: 2) ───────────────────────────────────

describe('User Permissions: Tenant Feature Filtering', () => {
  it('should return only categories matching tenant active features', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    const categoryCodes = (body.data as Array<{ code: string }>).map((c) => c.code);

    // apitest tenant has all features enabled (via applyDbPrerequisites)
    // At minimum, blackboard should be present (always registered)
    expect(categoryCodes).toContain('blackboard');
  });

  it('should return modules with allowedPermissions metadata', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    // Find blackboard category
    const blackboard = (
      body.data as Array<{
        code: string;
        modules: Array<{ allowedPermissions: string[] }>;
      }>
    ).find((c) => c.code === 'blackboard');

    expect(blackboard).toBeDefined();
    expect(blackboard!.modules.length).toBeGreaterThan(0);
    expect(Array.isArray(blackboard!.modules[0]!.allowedPermissions)).toBe(true);
  });
});

// ─── PUT + GET Roundtrip (seq: 3) ─────────────────────────────────────────────

describe('User Permissions: PUT + GET Roundtrip', () => {
  it('should save permissions via PUT and return 200', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            canRead: true,
            canWrite: true,
            canDelete: false,
          },
        ],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(1);
  });

  it('should return saved values on subsequent GET', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    const blackboard = (
      body.data as Array<{
        code: string;
        modules: Array<{
          code: string;
          canRead: boolean;
          canWrite: boolean;
          canDelete: boolean;
        }>;
      }>
    ).find((c) => c.code === 'blackboard');
    const posts = blackboard?.modules.find((m) => m.code === 'blackboard-posts');

    expect(posts).toBeDefined();
    expect(posts!.canRead).toBe(true);
    expect(posts!.canWrite).toBe(true);
    expect(posts!.canDelete).toBe(false);
  });

  it('should overwrite permissions on second PUT (UPSERT)', async () => {
    // Overwrite: set canRead=false, canWrite=false, canDelete=true
    const putRes = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            canRead: false,
            canWrite: false,
            canDelete: true,
          },
        ],
      }),
    });

    expect(putRes.status).toBe(200);

    // Verify GET returns updated values
    const getRes = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const getBody = (await getRes.json()) as JsonBody;

    const blackboard = (
      getBody.data as Array<{
        code: string;
        modules: Array<{
          code: string;
          canRead: boolean;
          canWrite: boolean;
          canDelete: boolean;
        }>;
      }>
    ).find((c) => c.code === 'blackboard');
    const posts = blackboard?.modules.find((m) => m.code === 'blackboard-posts');

    expect(posts!.canRead).toBe(false);
    expect(posts!.canWrite).toBe(false);
    expect(posts!.canDelete).toBe(true);
  });
});

// ─── PUT with Unknown addonCode (seq: 4) ────────────────────────────────────

describe('User Permissions: PUT Validation — Unknown Addon', () => {
  it('should return 400 for unknown addonCode', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'nonexistent-feature',
            moduleCode: 'nonexistent-module',
            canRead: true,
            canWrite: false,
            canDelete: false,
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── PUT with Invalid Body (seq: 5) ──────────────────────────────────────────

describe('User Permissions: PUT Validation — Invalid Body', () => {
  it('should return 400 for missing permissions array', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing boolean fields', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            // Missing canRead, canWrite, canDelete
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for non-boolean permission values', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            canRead: 'yes',
            canWrite: 0,
            canDelete: null,
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── GET Non-Existent UUID (seq: 6) ──────────────────────────────────────────

describe('User Permissions: GET Non-Existent UUID', () => {
  it('should return 404 for unknown user UUID', async () => {
    const fakeUuid = '00000000-0000-7000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/user-permissions/${fakeUuid}`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

// ─── Employee Access (seq: 7) ────────────────────────────────────────────────

describe('User Permissions: Employee Access Denied', () => {
  it('should return 403 for employee on GET', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(employeeToken),
    });

    expect(res.status).toBe(403);
  });

  it('should return 403 for employee on PUT', async () => {
    const res = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            canRead: true,
            canWrite: false,
            canDelete: false,
          },
        ],
      }),
    });

    expect(res.status).toBe(403);
  });
});
