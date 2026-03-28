/**
 * Users API Integration Tests
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
  loginApitest,
} from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- Get Current User (me) ----------------------------------------

describe('Users: Get Current User (me)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return user data with required properties', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('email');
    expect(body.data).toHaveProperty('role');
    expect(body.data).toHaveProperty('firstName');
    expect(body.data).toHaveProperty('lastName');
  });

  it('should not expose password', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).not.toHaveProperty('password');
  });

  it('should return tenant info', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('tenantId');
  });

  it('should have correct field types from assertions', async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.id).toBeTypeOf('number');
    expect(body.data.email).toBeTypeOf('string');
  });
});

// ---- seq: 2 -- List Users (Admin) -------------------------------------------

describe('Users: List Users (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/users?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return array of users', async () => {
    const res = await fetch(`${BASE_URL}/users?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should return pagination info', async () => {
    const res = await fetch(`${BASE_URL}/users?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.meta).toHaveProperty('pagination');
    expect(body.meta.pagination).toHaveProperty('totalItems');
    expect(body.meta.pagination).toHaveProperty('currentPage');
    expect(body.meta.pagination).toHaveProperty('pageSize');
  });
});

// ---- seq: 3 -- Get User by ID (Admin) ---------------------------------------

describe('Users: Get User by ID (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/users/${auth.userId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return user object with correct field types', async () => {
    const res = await fetch(`${BASE_URL}/users/${auth.userId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('email');
    expect(body.data).toHaveProperty('role');
    expect(body.data.id).toBeTypeOf('number');
  });
});

// ---- seq: 4 -- Create User with positionIds ---------------------------------

describe('Users: Create with positionIds', () => {
  let positionId: string;
  let createdUserId: number;
  const testEmail = `pos-test-${Date.now()}@apitest.de`;

  beforeAll(async () => {
    // Fetch available employee positions
    const res = await fetch(`${BASE_URL}/organigram/positions?roleCategory=employee`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    const positions = body.data as { id: string }[];
    if (positions[0] === undefined) throw new Error('No employee positions found');
    positionId = positions[0].id;
  });

  afterAll(async () => {
    // Cleanup: soft-delete created user
    if (createdUserId !== undefined) {
      await fetch(`${BASE_URL}/users/${createdUserId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  it('should create employee with positionIds', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPass123!',
        firstName: 'Position',
        lastName: 'TestUser',
        role: 'employee',
        positionIds: [positionId],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    createdUserId = body.data.id as number;
  });

  it('should persist positions in user_positions', async () => {
    const res = await fetch(`${BASE_URL}/users/${createdUserId}/positions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const positions = body.data as { positionId: string }[];
    expect(positions).toHaveLength(1);
    expect(positions[0]?.positionId).toBe(positionId);
  });

  it('should reject create without positionIds', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        email: `no-pos-${Date.now()}@apitest.de`,
        password: 'TestPass123!',
        firstName: 'No',
        lastName: 'Position',
        role: 'employee',
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ---- seq: 5 -- Update User positionIds --------------------------------------

describe('Users: Update positionIds', () => {
  let positionIds: string[];
  let targetUserId: number;
  const testEmail = `pos-upd-${Date.now()}@apitest.de`;

  beforeAll(async () => {
    // Fetch 2 employee positions
    const posRes = await fetch(`${BASE_URL}/organigram/positions?roleCategory=employee`, {
      headers: authOnly(auth.authToken),
    });
    const posBody = (await posRes.json()) as JsonBody;
    positionIds = (posBody.data as { id: string }[]).slice(0, 2).map((p: { id: string }) => p.id);

    // Create a user to update
    const createRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPass123!',
        firstName: 'Update',
        lastName: 'PosTest',
        role: 'employee',
        positionIds: [positionIds[0]],
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;
    targetUserId = createBody.data.id as number;
  });

  afterAll(async () => {
    if (targetUserId !== undefined) {
      await fetch(`${BASE_URL}/users/${targetUserId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  it('should update positions via PUT', async () => {
    const res = await fetch(`${BASE_URL}/users/${targetUserId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ positionIds: positionIds.slice(0, 2) }),
    });

    expect(res.status).toBe(200);
  });

  it('should reflect updated positions', async () => {
    const res = await fetch(`${BASE_URL}/users/${targetUserId}/positions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    const assigned = (body.data as { positionId: string }[]).map(
      (p: { positionId: string }) => p.positionId,
    );
    expect(assigned.sort()).toEqual(positionIds.slice(0, 2).sort());
  });
});
