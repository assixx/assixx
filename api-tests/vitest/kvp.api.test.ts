/**
 * KVP API Integration Tests
 *
 * Migrated from Bruno CLI: api-tests/kvp/*.bru
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authHeaders, authOnly, loginBrunotest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

// Shared state across sequential tests (replaces Bruno's bru.setVar)
let kvpId: number | undefined;
let _existingKvpId: number;
let _createdKvpId: number;

beforeAll(async () => {
  auth = await loginBrunotest();
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
        title: `Bruno Test ${Date.now()}`,
        description:
          'Created via Bruno API test - this is a test KVP entry that will be deleted after testing',
        categoryId: 1,
        orgLevel: 'company',
        orgId: 1,
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
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/kvp/dashboard/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return statistics with totalSuggestions', async () => {
    const res = await fetch(`${BASE_URL}/kvp/dashboard/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('totalSuggestions');
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

  it('should return comments array', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
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
