/**
 * Halls API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * CRUD lifecycle: List → Create → Get → Update → Delete
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

/** ID of hall created during this test run */
let hallId: number;

/** Fallback ID captured from list endpoint */
let _existingHallId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Halls ---------------------------------------------------

describe('Halls: List Halls', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/halls`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return halls array', async () => {
    const res = await fetch(`${BASE_URL}/halls`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    if (Array.isArray(body.data) && body.data.length > 0) {
      _existingHallId = body.data[0].id as number;
    }
  });
});

// ---- seq: 2 -- Get Hall Stats -----------------------------------------------

describe('Halls: Get Hall Stats', () => {
  it('should return 200 OK with stats', async () => {
    const res = await fetch(`${BASE_URL}/halls/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('totalHalls');
  });
});

// ---- seq: 3 -- Create Hall (Admin) ------------------------------------------

describe('Halls: Create Hall (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Hall ${Date.now()}`,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created hall with ID', async () => {
    const res = await fetch(`${BASE_URL}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Hall ${Date.now()}`,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');

    hallId = body.data.id as number;
  });
});

// ---- seq: 4 -- Get Hall by ID -----------------------------------------------

describe('Halls: Get Hall by ID', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/halls/${hallId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return hall object', async () => {
    const res = await fetch(`${BASE_URL}/halls/${hallId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });
});

// ---- seq: 5 -- Update Hall (Admin) ------------------------------------------

describe('Halls: Update Hall (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/halls/${hallId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Updated Hall ${Date.now()}`,
        description: 'Updated via API test',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 6 -- Delete Hall (Admin) ------------------------------------------

describe('Halls: Delete Hall (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/halls/${hallId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should confirm deletion', async () => {
    const createRes = await fetch(`${BASE_URL}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Delete Hall ${Date.now()}`,
        description: 'Created for deletion confirmation test',
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;
    const deleteHallId = createBody.data.id as number;

    const res = await fetch(`${BASE_URL}/halls/${deleteHallId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.success).toBe(true);

    if (_existingHallId) {
      hallId = _existingHallId;
    }
  });
});
