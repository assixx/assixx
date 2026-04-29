/**
 * Admin Permissions API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests GET endpoints for admin permissions management.
 *
 * Regression: GET /admin-permissions/:adminId returned 500 because
 * db.query() ran without RLS tenant context. Fixed by using
 * db.queryAsTenant() + NotFoundException (404).
 *
 * Scenarios:
 *   1. GET /admin-permissions/my — root gets full-access response
 *   2. GET /admin-permissions/:adminId — root fetches specific admin (was 500, now 200)
 *   3. GET /admin-permissions/:nonExistentId — returns 404 (not 500)
 *   4. Employee gets 403 on root-only endpoints
 */
import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  ensureTestEmployee,
  getDefaultPositionIds,
  loginApitest,
  loginNonRoot,
} from './helpers.js';

let auth: AuthState;
let testAdminId: number;
let employeeToken: string;

beforeAll(async () => {
  auth = await loginApitest();

  // Ensure a test admin exists for permission queries
  const positionIds = await getDefaultPositionIds(auth.authToken);
  const createRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      email: 'perm-test-admin@assixx.com',
      password: APITEST_PASSWORD,
      firstName: 'PermTest',
      lastName: 'Admin',
      role: 'admin',
      phone: '+49123456799',
      positionIds,
    }),
  });

  if (createRes.status === 201) {
    const body = (await createRes.json()) as JsonBody;
    testAdminId = body.data.id as number;
  } else {
    // Already exists — find in user list
    const listRes = await fetch(`${BASE_URL}/users?role=admin&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const listBody = (await listRes.json()) as JsonBody;
    const admins = listBody.data as Array<{ id: number; email: string }>;
    const existing = admins.find((u) => u.email === 'perm-test-admin@assixx.com');
    if (!existing) throw new Error('Test admin not found after create attempt');
    testAdminId = existing.id;
  }

  // Ensure test employee + login for 403 tests. Full 2-step 2FA dance per
  // FEAT_2FA_EMAIL Step 2.4 — `loginNonRoot` consolidates the pattern.
  await ensureTestEmployee(auth.authToken);
  employeeToken = await loginNonRoot('employee@assixx.com', APITEST_PASSWORD);
});

// ─── GET /admin-permissions/my (seq: 1) ─────────────────────────────────────

describe('Admin Permissions: GET /my as root', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/admin-permissions/my`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success true', () => {
    expect(body.success).toBe(true);
  });

  it('should grant root full access', () => {
    expect(body.data.hasFullAccess).toBe(true);
  });
});

// ─── GET /admin-permissions/:adminId (seq: 2) — REGRESSION ──────────────────

describe('Admin Permissions: GET /:adminId as root (was 500, now 200)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/admin-permissions/${testAdminId}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK (not 500)', () => {
    expect(res.status).toBe(200);
  });

  it('should return success true', () => {
    expect(body.success).toBe(true);
  });

  it('should return permissions structure', () => {
    expect(body.data).toHaveProperty('areas');
    expect(body.data).toHaveProperty('departments');
    expect(body.data).toHaveProperty('hasFullAccess');
    expect(body.data).toHaveProperty('totalAreas');
    expect(body.data).toHaveProperty('totalDepartments');
  });

  it('should return arrays for areas and departments', () => {
    expect(Array.isArray(body.data.areas)).toBe(true);
    expect(Array.isArray(body.data.departments)).toBe(true);
  });
});

// ─── GET /admin-permissions/:nonExistent (seq: 3) ───────────────────────────

describe('Admin Permissions: GET /:nonExistentId returns 404', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/admin-permissions/999999`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 404 (not 500)', () => {
    expect(res.status).toBe(404);
  });
});

// ─── Employee access denied (seq: 4) ────────────────────────────────────────

describe('Admin Permissions: Employee access control', () => {
  it('should return 200 on GET /my (open to all authenticated users)', async () => {
    const res = await fetch(`${BASE_URL}/admin-permissions/my`, {
      headers: authOnly(employeeToken),
    });
    expect(res.status).toBe(200);
  });

  it('should return 403 on GET /:adminId (root only)', async () => {
    const res = await fetch(`${BASE_URL}/admin-permissions/${testAdminId}`, {
      headers: authOnly(employeeToken),
    });
    expect(res.status).toBe(403);
  });
});
