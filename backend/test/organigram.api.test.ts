/**
 * Organigram API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Requires root role (signup admin = root).
 *
 * @see vitest.config.ts (project: api)
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

// ─── seq: 1 -- Auth Guard ───────────────────────────────────────────────────

describe('Organigram: Auth', () => {
  it('should return 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/organigram/tree`);

    expect(res.status).toBe(401);
  });
});

// ─── seq: 2 -- GET /organigram/tree ─────────────────────────────────────────

describe('Organigram: Tree', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/organigram/tree`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should contain companyName and hierarchyLabels', async () => {
    const res = await fetch(`${BASE_URL}/organigram/tree`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('companyName');
    expect(body.data.companyName).toBeTypeOf('string');
    expect(body.data).toHaveProperty('hierarchyLabels');
    expect(body.data.hierarchyLabels).toHaveProperty('area');
    expect(body.data.hierarchyLabels).toHaveProperty('department');
    expect(body.data.hierarchyLabels).toHaveProperty('team');
    expect(body.data.hierarchyLabels).toHaveProperty('asset');
  });

  it('should contain nodes array', async () => {
    const res = await fetch(`${BASE_URL}/organigram/tree`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data.nodes)).toBe(true);
  });
});

// ─── seq: 3 -- GET /organigram/hierarchy-labels ─────────────────────────────

describe('Organigram: Get Hierarchy Labels', () => {
  it('should return 200 OK with label structure', async () => {
    const res = await fetch(`${BASE_URL}/organigram/hierarchy-labels`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('area');
    expect(body.data).toHaveProperty('department');
    expect(body.data).toHaveProperty('team');
    expect(body.data).toHaveProperty('asset');
  });

  it('should return a string for each level', async () => {
    const res = await fetch(`${BASE_URL}/organigram/hierarchy-labels`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    for (const level of ['area', 'department', 'team', 'asset']) {
      expect(body.data[level]).toBeTypeOf('string');
    }
  });
});

// ─── seq: 4 -- PATCH /organigram/hierarchy-labels ───────────────────────────

describe('Organigram: Update Hierarchy Labels', () => {
  it('should update partial labels and return merged result', async () => {
    const res = await fetch(`${BASE_URL}/organigram/hierarchy-labels`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        levels: {
          area: 'Werke',
        },
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.area).toBe('Werke');
    // Other levels should still have values
    expect(body.data.department).toBeTypeOf('string');
  });

  it('should persist updated labels across requests', async () => {
    // Update
    await fetch(`${BASE_URL}/organigram/hierarchy-labels`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        levels: {
          team: 'Crews',
        },
      }),
    });

    // Re-read
    const res = await fetch(`${BASE_URL}/organigram/hierarchy-labels`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.team).toBe('Crews');
  });
});

// ─── seq: 5 -- PUT /organigram/positions ────────────────────────────────────

describe('Organigram: Upsert Positions', () => {
  it('should upsert positions and return 200', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        positions: [
          {
            entityType: 'area',
            entityUuid: 'a0000000-0000-0000-0000-000000test01',
            positionX: 100,
            positionY: 200,
            width: 300,
            height: 150,
          },
        ],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should reject empty positions array', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ positions: [] }),
    });

    expect(res.status).toBe(400);
  });

  it('should reject invalid entityType', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        positions: [
          {
            entityType: 'invalid',
            entityUuid: 'a0000000-0000-0000-0000-000000test01',
            positionX: 0,
            positionY: 0,
            width: 200,
            height: 80,
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});
