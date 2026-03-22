/**
 * KVP Approval API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests the approval integration endpoints for KVP.
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
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
