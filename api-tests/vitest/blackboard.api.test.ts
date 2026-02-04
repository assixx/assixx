/**
 * Blackboard API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import {
  BASE_URL,
  authHeaders,
  authOnly,
  loginApitest,
  type AuthState,
  type JsonBody,
} from './helpers.js';

let auth: AuthState;

// Module-level state shared across sequential describe blocks
let blackboardEntryId: number;
let existingBlackboardId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ─── List Blackboard Entries (seq: 1) ───────────────────────────────────────

describe('List Blackboard Entries', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return entries array', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toBeInstanceOf(Array);

    // Store first existing entry ID for fallback after delete
    if (body.data.length > 0) {
      existingBlackboardId = body.data[0].id;
    }
  });

  it('should return pagination info', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.meta.pagination).toBeTypeOf('object');
  });
});

// ─── Create Blackboard Entry (seq: 2) ───────────────────────────────────────

describe('Create Blackboard Entry (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        content: 'Created via API test - will be deleted',
        priority: 'medium',
        orgLevel: 'company',
        requiresConfirmation: false,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created entry', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/entries`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        content: 'Created via API test - will be deleted',
        priority: 'medium',
        orgLevel: 'company',
        requiresConfirmation: false,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data.title).toContain('API Test');

    // Store created entry ID for subsequent tests
    if (body.data?.id) {
      blackboardEntryId = body.data.id;
    }
  });
});

// ─── Get Blackboard Entry (seq: 2) ──────────────────────────────────────────

describe('Get Blackboard Entry', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return entry object', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
  });
});

// ─── Get Entry Full (seq: 3) ────────────────────────────────────────────────

describe('Get Entry Full (with comments and attachments)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/full`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return entry with comments and attachments', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/full`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('entry');
    expect(body.data).toHaveProperty('comments');
    expect(body.data).toHaveProperty('attachments');
  });
});

// ─── Update Blackboard Entry (seq: 5) ───────────────────────────────────────

describe('Update Blackboard Entry (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}`,
      {
        method: 'PUT',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({
          title: 'Updated Announcement',
          content: 'Updated content via API test',
          priority: 'high',
        }),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Confirm Entry (seq: 6) ─────────────────────────────────────────────────

describe('Confirm Entry (Mark as Read)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/confirm`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({}),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Get Entry Comments (seq: 7) ────────────────────────────────────────────

describe('Get Entry Comments', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/comments`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return comments array', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/comments`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(body.data).toBeInstanceOf(Array);
  });
});

// ─── Add Comment to Entry (seq: 8) ──────────────────────────────────────────

describe('Add Comment to Entry', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/comments`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({
          comment: 'This is a test comment from API integration test.',
          isInternal: false,
        }),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

// ─── Get Dashboard Entries (seq: 9) ─────────────────────────────────────────

describe('Get Dashboard Entries', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/dashboard`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return dashboard entries', async () => {
    const res = await fetch(`${BASE_URL}/blackboard/dashboard`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toBeInstanceOf(Array);
  });
});

// ─── Archive Entry (seq: 10) ────────────────────────────────────────────────

describe('Archive Entry (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}/archive`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({}),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Delete Entry (seq: 11) ─────────────────────────────────────────────────

describe('Delete Entry (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/blackboard/entries/${blackboardEntryId}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Reset created ID; fall back to existing entry for future use
    if (existingBlackboardId) {
      blackboardEntryId = existingBlackboardId;
    }
  });
});
