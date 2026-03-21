/**
 * Position Catalog API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * CRUD lifecycle, system position protection, user assignment,
 * backward-compat facade, approval config with position type.
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

/** UUID of position created during this test run */
let createdPositionId: string;

/** UUID of a system position (team_lead) */
let systemPositionId: string;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- Unauthenticated → 401 ----------------------------------------

describe('Position Catalog: Unauthenticated', () => {
  it('should return 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`);

    expect(res.status).toBe(401);
  });
});

// ---- seq: 2 -- List Positions (seeds system positions) -----------------------

describe('Position Catalog: List Positions', () => {
  it('should return 200 with system positions auto-seeded', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const positions = body.data as JsonBody[];
    const systemPositions = positions.filter((p: JsonBody) => p.isSystem === true);
    expect(systemPositions.length).toBeGreaterThanOrEqual(3);

    const teamLead = positions.find((p: JsonBody) => p.name === 'team_lead') as
      | JsonBody
      | undefined;
    expect(teamLead).toBeDefined();
    expect(teamLead?.roleCategory).toBe('employee');
    expect(teamLead?.isSystem).toBe(true);

    systemPositionId = teamLead?.id as string;
  });

  it('should filter by roleCategory', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions?roleCategory=admin`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const positions = body.data as JsonBody[];
    for (const p of positions) {
      expect(p.roleCategory).toBe('admin');
    }
  });
});

// ---- seq: 3 -- Create Position -----------------------------------------------

describe('Position Catalog: Create Position', () => {
  it('should create a custom position', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API-Test-Position-${Date.now()}`,
        roleCategory: 'employee',
        sortOrder: 10,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.isSystem).toBe(false);
    expect(body.data.sortOrder).toBe(10);
    expect(body.data.id).toBeDefined();

    createdPositionId = body.data.id as string;
  });

  it('should reject duplicate name + category', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'team_lead',
        roleCategory: 'employee',
      }),
    });

    expect(res.status).toBe(409);
  });
});

// ---- seq: 4 -- Update Position -----------------------------------------------

describe('Position Catalog: Update Position', () => {
  it('should rename a custom position', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions/${createdPositionId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ name: 'Renamed-Position' }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.name).toBe('Renamed-Position');
    expect(body.data.id).toBe(createdPositionId);
  });

  it('should block editing system positions', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions/${systemPositionId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ name: 'Hacked' }),
    });

    expect(res.status).toBe(403);
  });
});

// ---- seq: 5 -- User Position Assignment --------------------------------------

describe('Position Catalog: User Position Assignment', () => {
  it('should assign position to user', async () => {
    const res = await fetch(`${BASE_URL}/users/${String(auth.userId)}/positions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ positionId: createdPositionId }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.message).toBe('Position zugewiesen');
  });

  it('should list assigned positions', async () => {
    const res = await fetch(`${BASE_URL}/users/${String(auth.userId)}/positions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const positions = body.data as JsonBody[];
    const assigned = positions.find((p: JsonBody) => p.positionId === createdPositionId);
    expect(assigned).toBeDefined();
    expect(assigned?.positionName).toBe('Renamed-Position');
  });

  it('should be idempotent — second assign does not fail', async () => {
    const res = await fetch(`${BASE_URL}/users/${String(auth.userId)}/positions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ positionId: createdPositionId }),
    });

    expect(res.status).toBe(201);
  });

  it('should unassign position from user', async () => {
    const res = await fetch(
      `${BASE_URL}/users/${String(auth.userId)}/positions/${createdPositionId}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );

    expect(res.status).toBe(204);
  });
});

// ---- seq: 6 -- Delete Position -----------------------------------------------

describe('Position Catalog: Delete Position', () => {
  it('should block deleting system positions', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions/${systemPositionId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(403);
  });

  it('should soft-delete a custom position', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions/${createdPositionId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(204);
  });

  it('should not appear in list after deletion', async () => {
    const res = await fetch(`${BASE_URL}/organigram/positions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    const positions = body.data as JsonBody[];
    const deleted = positions.find((p: JsonBody) => p.id === createdPositionId);

    expect(deleted).toBeUndefined();
  });
});
