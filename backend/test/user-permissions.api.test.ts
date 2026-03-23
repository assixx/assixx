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

// ─── REGRESSION: prevent_manage_permissions_self_grant trigger (seq: 8) ──────
//
// Bug: Trigger referenced `t.deputy_lead_id` (old column, renamed to
// `t.team_deputy_lead_id`). Crashed with 500 on ANY manage-permissions
// canWrite grant by a non-root user.
//
// This test exercises the exact bug path:
//   1. Root sets up hierarchy + team lead + deputy
//   2. Root grants manage-permissions.canWrite to team lead
//   3. Team lead (non-root!) grants manage-permissions to deputy
//   4. Trigger fires → assigned_by is team lead → query hits teams table
//
// @see Migration 20260323212817346_fix-self-grant-trigger-deputy-columns

/** Helper: POST JSON and return parsed body. Throws on non-ok status. */
async function postJson(
  url: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<JsonBody> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as JsonBody;
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return body;
}

/** Helper: PUT JSON and return parsed body. Throws on non-ok status. */
async function putJson(
  url: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<JsonBody> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as JsonBody;
  if (!res.ok) throw new Error(`PUT ${url} → ${res.status}`);
  return body;
}

describe('REGRESSION: manage-permissions self-grant trigger with deputy columns', () => {
  const uniqueSuffix = Date.now();
  let teamLeadToken = '';
  let deputyUuid = '';
  let setupOk = false;

  beforeAll(async () => {
    try {
      const token = auth.authToken;
      const leadEmail = `trigger-lead-${uniqueSuffix}@apitest.de`;

      // 1. Hierarchy: Area → Department → Team
      const area = await postJson(`${BASE_URL}/areas`, token, {
        name: `TriggerTest Area ${uniqueSuffix}`,
      });
      const dept = await postJson(`${BASE_URL}/departments`, token, {
        name: `TriggerTest Dept ${uniqueSuffix}`,
        areaId: area.data.id,
      });
      const team = await postJson(`${BASE_URL}/teams`, token, {
        name: `TriggerTest Team ${uniqueSuffix}`,
        departmentId: dept.data.id,
      });

      // 2. Two employees with position 'team_lead'
      const lead = await postJson(`${BASE_URL}/users`, token, {
        email: leadEmail,
        password: APITEST_PASSWORD,
        firstName: 'TriggerLead',
        lastName: 'Test',
        role: 'employee',
        position: 'team_lead',
      });
      const deputy = await postJson(`${BASE_URL}/users`, token, {
        email: `trigger-deputy-${uniqueSuffix}@apitest.de`,
        password: APITEST_PASSWORD,
        firstName: 'TriggerDeputy',
        lastName: 'Test',
        role: 'employee',
        position: 'team_lead',
      });
      deputyUuid = deputy.data.uuid as string;

      // 3. Add as team members + assign lead/deputy
      await postJson(`${BASE_URL}/teams/${team.data.id}/members`, token, {
        userId: lead.data.id,
      });
      await postJson(`${BASE_URL}/teams/${team.data.id}/members`, token, {
        userId: deputy.data.id,
      });
      await putJson(`${BASE_URL}/teams/${team.data.id}`, token, {
        leaderId: lead.data.id,
        teamDeputyLeadId: deputy.data.id,
      });

      // 4. Root grants manage-permissions to team lead
      await putJson(`${BASE_URL}/user-permissions/${lead.data.uuid}`, token, {
        permissions: [
          {
            addonCode: 'manage_hierarchy',
            moduleCode: 'manage-permissions',
            canRead: true,
            canWrite: true,
            canDelete: false,
          },
        ],
      });

      // 5. Login as team lead
      const loginRes = await fetchWithRetry(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leadEmail, password: APITEST_PASSWORD }),
      });
      const loginBody = (await loginRes.json()) as JsonBody;
      teamLeadToken = loginBody.data.accessToken as string;

      setupOk = true;
    } catch {
      // Setup failure — test will fail with clear assertion below
    }
  });

  it('should allow team lead to grant manage-permissions to deputy (200, not 500)', async () => {
    // Precondition: setup must have completed (hierarchy + lead login)
    expect(setupOk, 'Test setup incomplete — hierarchy or user creation failed').toBe(true);

    // Team lead grants manage-permissions.canWrite to deputy.
    // This fires prevent_manage_permissions_self_grant with assigned_by = team_lead (not root!).
    // Before the fix: 500 (column t.deputy_lead_id does not exist)
    // After the fix: 200 (trigger uses t.team_deputy_lead_id)
    const res = await fetch(`${BASE_URL}/user-permissions/${deputyUuid}`, {
      method: 'PUT',
      headers: authHeaders(teamLeadToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'manage_hierarchy',
            moduleCode: 'manage-permissions',
            canRead: true,
            canWrite: true,
            canDelete: false,
          },
        ],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(
      res.status,
      `Expected 200 but got ${res.status}: ${body.error?.message ?? 'no error'}`,
    ).toBe(200);
    expect(body.success).toBe(true);
  });
});
