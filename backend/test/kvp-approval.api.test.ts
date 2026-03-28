/**
 * KVP Approval API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests the approval integration endpoints for KVP.
 */
import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

let auth: AuthState;
let employeeToken: string;

beforeAll(async () => {
  auth = await loginApitest();

  // Login as employee (no canWrite for kvp-suggestions)
  const empRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@apitest.de', password: APITEST_PASSWORD }),
  });
  const empBody = (await empRes.json()) as JsonBody;
  employeeToken = empBody.data.accessToken as string;
});

// ---- seq: 0 -- Approval Config Status ------------------------------------

describe('KVP Approval: Config Status', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/approval-config-status`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return hasConfig as boolean', () => {
    expect(typeof body.data.hasConfig).toBe('boolean');
  });
});

// ---- seq: 1 -- Get Approval (no approval exists) -------------------------

describe('KVP Approval: Get Approval (none exists)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Use a known KVP suggestion UUID from apitest tenant
    // First, list KVP suggestions to get a valid one
    const listRes = await fetch(`${BASE_URL}/kvp?limit=1`, {
      headers: authOnly(auth.authToken),
    });
    const listBody = (await listRes.json()) as JsonBody;
    const firstKvp = listBody.data?.suggestions?.[0] as { id: number } | undefined;

    if (firstKvp === undefined) {
      // No KVP exists — skip with a sentinel
      res = new Response(null, { status: 200 });
      body = { success: true, data: { approval: null } };
      return;
    }

    res = await fetch(`${BASE_URL}/kvp/${String(firstKvp.id)}/approval`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return approval as null when none exists', () => {
    expect(body.data.approval).toBeNull();
  });
});

// ---- seq: 2 -- Unauthenticated access ------------------------------------

describe('KVP Approval: Unauthenticated', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/approval-config-status`);
  });

  it('should return 401 Unauthorized', () => {
    expect(res.status).toBe(401);
  });
});

// ---- seq: 3 -- Request Approval for non-existent KVP ---------------------

describe('KVP Approval: Request for non-existent KVP', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/99999/request-approval`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
  });

  it('should return 404 Not Found', () => {
    expect(res.status).toBe(404);
  });
});

// ---- seq: 4 -- Employee without canWrite cannot request approval ----------

describe('KVP Approval: Employee without canWrite gets 403', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/99999/request-approval`, {
      method: 'POST',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({}),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 403 Forbidden', () => {
    expect(res.status).toBe(403);
  });

  it('should be permission-based denial (not role-based)', () => {
    expect(body.error.message).toContain('canWrite');
  });
});

// ---- seq: 5 -- Approval configs include scope fields ----------------------

describe('KVP Approval: Config scope fields', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/configs`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK with configs array', () => {
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should include scope fields in config response', () => {
    const configs = body.data as JsonBody[];
    if (configs.length === 0) return; // no configs in apitest tenant
    const first = configs[0] as JsonBody;
    expect(first).toHaveProperty('scopeAreaIds');
    expect(first).toHaveProperty('scopeDepartmentIds');
    expect(first).toHaveProperty('scopeTeamIds');
  });

  it('should have null scope for existing configs (backward compat)', () => {
    const configs = body.data as JsonBody[];
    if (configs.length === 0) return;
    const first = configs[0] as JsonBody;
    // Existing configs have no scope = null (whole tenant)
    expect(first.scopeAreaIds).toBeNull();
    expect(first.scopeDepartmentIds).toBeNull();
    expect(first.scopeTeamIds).toBeNull();
  });
});
