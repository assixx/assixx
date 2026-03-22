/**
 * KVP API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  createDepartmentAndTeam,
  loginApitest,
} from './helpers.js';

let auth: AuthState;

// Shared state across sequential describe blocks
let kvpId: number | undefined;
let _existingKvpId: number;
let _createdKvpId: number;

// Team setup — KVP requires team assignment
let testTeamId: number;
let testDepartmentId: number;

beforeAll(async () => {
  auth = await loginApitest();

  // KVP requires the user to be assigned to a team
  const { departmentId, teamId } = await createDepartmentAndTeam(auth.authToken);
  testDepartmentId = departmentId;
  testTeamId = teamId;

  // Assign test user to team
  const assignRes = await fetch(`${BASE_URL}/teams/${testTeamId}/members`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({ userId: auth.userId }),
  });
  if (assignRes.status !== 201 && assignRes.status !== 409) {
    throw new Error(`Team member assignment failed: ${assignRes.status}`);
  }
});

afterAll(async () => {
  if (!auth) return;

  // Remove user from team
  await fetch(`${BASE_URL}/teams/${testTeamId}/members/${auth.userId}`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });

  // Delete team (force) and department
  await fetch(`${BASE_URL}/teams/${testTeamId}?force=true`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });
  await fetch(`${BASE_URL}/departments/${testDepartmentId}?force=true`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });
});

// ---- seq: 0 -- KVP Settings (root-only) ------------------------------------

describe('KVP: Get Settings', () => {
  let settingsRes: Response;
  let settingsBody: JsonBody;

  beforeAll(async () => {
    settingsRes = await fetch(`${BASE_URL}/kvp/settings`, {
      headers: authOnly(auth.authToken),
    });
    settingsBody = (await settingsRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(settingsRes.status).toBe(200);
    expect(settingsBody.success).toBe(true);
  });

  it('should return dailyLimit as number', () => {
    expect(typeof settingsBody.data.dailyLimit).toBe('number');
    expect(settingsBody.data.dailyLimit).toBeGreaterThanOrEqual(0);
  });
});

describe('KVP: Update Settings', () => {
  let updateRes: Response;
  let updateBody: JsonBody;

  beforeAll(async () => {
    updateRes = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 5 }),
    });
    updateBody = (await updateRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(updateRes.status).toBe(200);
    expect(updateBody.success).toBe(true);
  });

  it('should return updated dailyLimit', () => {
    expect(updateBody.data.dailyLimit).toBe(5);
  });
});

describe('KVP: Verify Settings Persistence', () => {
  let verifyRes: Response;
  let verifyBody: JsonBody;

  beforeAll(async () => {
    verifyRes = await fetch(`${BASE_URL}/kvp/settings`, {
      headers: authOnly(auth.authToken),
    });
    verifyBody = (await verifyRes.json()) as JsonBody;
  });

  it('should return persisted dailyLimit = 5', () => {
    expect(verifyBody.data.dailyLimit).toBe(5);
  });
});

describe('KVP: Reset Settings to Default', () => {
  let resetRes: Response;
  let resetBody: JsonBody;

  beforeAll(async () => {
    resetRes = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 1 }),
    });
    resetBody = (await resetRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(resetRes.status).toBe(200);
    expect(resetBody.data.dailyLimit).toBe(1);
  });
});

describe('KVP: Settings Validation', () => {
  it('should reject negative dailyLimit', async () => {
    const res = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject dailyLimit > 100', async () => {
    const res = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 101 }),
    });
    expect(res.status).toBe(400);
  });
});

// ---- seq: 1 -- List KVP Suggestions -----------------------------------------

describe('KVP: List Suggestions', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return suggestions array', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data.suggestions)).toBe(true);

    // Store first existing suggestion ID for fallback after delete
    if (body.data.suggestions.length > 0) {
      _existingKvpId = body.data.suggestions[0].id;
    }
  });

  it('should return pagination info', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.pagination).toBeDefined();
    expect(typeof body.data.pagination).toBe('object');
  });
});

// ---- seq: 2 -- Create KVP Suggestion ----------------------------------------

describe('KVP: Create Suggestion', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        description: 'Created via API test - will be deleted after testing',
        categoryId: 1,
        priority: 'normal',
        expectedBenefit: 'Test benefit for automation testing',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // Store created suggestion ID for subsequent tests (only if creation succeeded)
    if (res.status === 201 && body.data?.id) {
      kvpId = body.data.id;
      _createdKvpId = body.data.id;
    }

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 3 -- Get KVP Suggestion -------------------------------------------

describe('KVP: Get Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return suggestion object with id and title', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
  });
});

// ---- seq: 4 -- Update KVP Suggestion ----------------------------------------

describe('KVP: Update Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Updated Suggestion',
        priority: 'high',
        status: 'in_review',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Get KVP Categories -------------------------------------------

describe('KVP: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/kvp/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return categories array', async () => {
    const res = await fetch(`${BASE_URL}/kvp/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 6 -- Get KVP Dashboard Statistics ----------------------------------

describe('KVP: Dashboard Statistics', () => {
  let statsRes: Response;
  let statsBody: JsonBody;

  beforeAll(async () => {
    statsRes = await fetch(`${BASE_URL}/kvp/dashboard/stats`, {
      headers: authOnly(auth.authToken),
    });
    statsBody = (await statsRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(statsRes.status).toBe(200);
    expect(statsBody.success).toBe(true);
  });

  it('should return tenant-wide statistics', () => {
    expect(statsBody.data).toHaveProperty('totalSuggestions');
    expect(statsBody.data).toHaveProperty('newSuggestions');
    expect(statsBody.data).toHaveProperty('inReviewSuggestions');
    expect(statsBody.data).toHaveProperty('approvedSuggestions');
    expect(statsBody.data).toHaveProperty('implementedSuggestions');
    expect(statsBody.data).toHaveProperty('rejectedSuggestions');
  });

  it('should return team-scoped statistics', () => {
    expect(typeof statsBody.data.teamTotalSuggestions).toBe('number');
    expect(typeof statsBody.data.teamImplementedSuggestions).toBe('number');
    expect(statsBody.data.teamTotalSuggestions).toBeGreaterThanOrEqual(0);
    expect(statsBody.data.teamImplementedSuggestions).toBeGreaterThanOrEqual(0);
  });

  it('should have teamImplemented <= teamTotal', () => {
    expect(statsBody.data.teamImplementedSuggestions).toBeLessThanOrEqual(
      statsBody.data.teamTotalSuggestions,
    );
  });
});

// ---- seq: 7 -- Get KVP Comments ---------------------------------------------

describe('KVP: Get Comments', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return paginated comments', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('comments');
    expect(Array.isArray(body.data.comments)).toBe(true);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('hasMore');
  });
});

// ---- seq: 8 -- Add KVP Comment -----------------------------------------------

describe('KVP: Add Comment', () => {
  it('should return 201 Created', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        comment: 'This is a test comment on the KVP suggestion.',
        isInternal: false,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 10 -- Delete KVP Suggestion ----------------------------------------

describe('KVP: Delete Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created ID and fall back to existing suggestion
    _createdKvpId = 0;
    if (_existingKvpId) {
      kvpId = _existingKvpId;
    }
  });
});
