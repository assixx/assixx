/**
 * Approvals — API Integration Tests
 *
 * Tests the full approval lifecycle against the real Docker backend:
 * config CRUD, approval create, approve, reject, stats.
 *
 * Runs as root (info@assixx.com = root with has_full_access=true).
 * Core addon — no tenant_addons setup needed.
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

// Shared state across describe blocks
let configUuid: string;
let approvalUuid: string;

// =============================================================================
// Config: List (initially empty for this addon)
// =============================================================================

describe('Approvals Config: List', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/configs`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return success true', () => {
    expect(body.success).toBe(true);
  });

  it('should return array', () => {
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// =============================================================================
// Config: Create
// =============================================================================

describe('Approvals Config: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/configs`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        addonCode: 'kvp',
        approverType: 'user',
        approverUserId: auth.userId,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.uuid) {
      configUuid = body.data.uuid as string;
    }
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return created config', () => {
    expect(body.data).toHaveProperty('uuid');
    expect(body.data.addonCode).toBe('kvp');
    expect(body.data.approverType).toBe('user');
  });
});

// =============================================================================
// Approval: Create
// =============================================================================

describe('Approvals: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        addonCode: 'kvp',
        sourceEntityType: 'kvp_suggestion',
        sourceUuid: '00000000-0000-0000-0000-000000000001',
        title: 'API Test Approval',
        priority: 'medium',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.uuid) {
      approvalUuid = body.data.uuid as string;
    }
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
  });

  it('should return approval with pending status', () => {
    expect(body.data).toHaveProperty('uuid');
    expect(body.data.status).toBe('pending');
    expect(body.data.addonCode).toBe('kvp');
    expect(body.data.title).toBe('API Test Approval');
  });
});

// =============================================================================
// Approval: List All
// =============================================================================

describe('Approvals: List All', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return paginated result', () => {
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('page');
  });

  it('should contain the created approval', () => {
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Approval: My Approvals
// =============================================================================

describe('Approvals: My Approvals', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/my`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return array of my requested approvals', () => {
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// =============================================================================
// Approval: Stats
// =============================================================================

describe('Approvals: Stats', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/stats`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return stats object with counts', () => {
    expect(body.data).toHaveProperty('pending');
    expect(body.data).toHaveProperty('approved');
    expect(body.data).toHaveProperty('rejected');
    expect(body.data).toHaveProperty('total');
  });

  it('should have at least 1 pending', () => {
    expect(body.data.pending).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Approval: Get By UUID
// =============================================================================

describe('Approvals: Get By UUID', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/${approvalUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return the approval', () => {
    expect(body.data.uuid.trim()).toBe(approvalUuid);
    expect(body.data.status).toBe('pending');
  });
});

// =============================================================================
// Approval: Reject without note → 400
// =============================================================================

describe('Approvals: Reject without note', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/${approvalUuid}/reject`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
  });

  it('should return 400 (note required)', () => {
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// Approval: Approve (self-approve — will fail because requester = decider)
// NOTE: Root user created the approval AND tries to approve it.
// This should throw ForbiddenException (self-approve prevention).
// =============================================================================

describe('Approvals: Self-approve prevention', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/${approvalUuid}/approve`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
  });

  it('should return 403 (self-approve blocked)', () => {
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// Cleanup: Create a second approval from a "different perspective"
// and approve it to test the happy path.
// Since we only have one test user, we test the reject path with note.
// =============================================================================

describe('Approvals: Reject with note', () => {
  let rejectRes: Response;

  beforeAll(async () => {
    // Self-reject is also blocked (same user created + decides).
    // Verifies the 403 — happy-path approve/reject tested via unit tests.
    rejectRes = await fetch(`${BASE_URL}/approvals/${approvalUuid}/reject`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ decisionNote: 'Not approved - test' }),
    });
  });

  it('should return 403 (self-reject also blocked)', () => {
    // Same user created and tries to reject — blocked
    expect(rejectRes.status).toBe(403);
  });
});

// =============================================================================
// Config: Delete
// =============================================================================

describe('Approvals Config: Delete', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals/configs/${configUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// Unauthenticated → 401
// =============================================================================

describe('Approvals: Unauthenticated', () => {
  it('should return 401 for configs without token', async () => {
    const res = await fetch(`${BASE_URL}/approvals/configs`);
    expect(res.status).toBe(401);
  });

  it('should return 401 for list without token', async () => {
    const res = await fetch(`${BASE_URL}/approvals`);
    expect(res.status).toBe(401);
  });

  it('should return 401 for stats without token', async () => {
    const res = await fetch(`${BASE_URL}/approvals/stats`);
    expect(res.status).toBe(401);
  });
});
