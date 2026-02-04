/**
 * Machines API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authHeaders, authOnly, loginApitest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

// Shared state across sequential describe blocks
let machineId: number;
let _existingMachineId: number;
let _createdMachineId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Machines -------------------------------------------------

describe('Machines: List', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return machines array', async () => {
    const res = await fetch(`${BASE_URL}/machines`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Store first existing machine ID for fallback after delete
    if (body.data.length > 0) {
      _existingMachineId = body.data[0].id;
    }
  });
});

// ---- seq: 2 -- Create Machine (Admin) ----------------------------------------

describe('Machines: Create (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/machines`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test ${Date.now()}`,
        model: 'TM-001',
        manufacturer: 'Test Corp',
        machineType: 'production',
        status: 'operational',
        location: 'Test Location',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    // Store created machine ID for subsequent tests
    if (body.data?.id) {
      machineId = body.data.id;
      _createdMachineId = body.data.id;
    }
  });
});

// ---- seq: 3 -- Get Machine by ID --------------------------------------------

describe('Machines: Get by ID', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return machine object with id and name', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });
});

// ---- seq: 4 -- Update Machine (Admin) ----------------------------------------

describe('Machines: Update (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Updated Machine Name',
        status: 'maintenance',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Get Machine Statistics ----------------------------------------

describe('Machines: Statistics', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/statistics`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return statistics with totalMachines', async () => {
    const res = await fetch(`${BASE_URL}/machines/statistics`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('totalMachines');
  });
});

// ---- seq: 6 -- Get Machine Categories ----------------------------------------

describe('Machines: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return categories array', async () => {
    const res = await fetch(`${BASE_URL}/machines/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 7 -- Get Upcoming Maintenance --------------------------------------

describe('Machines: Upcoming Maintenance', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/upcoming-maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return machines needing maintenance', async () => {
    const res = await fetch(`${BASE_URL}/machines/upcoming-maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 8 -- Get Maintenance History ---------------------------------------

describe('Machines: Maintenance History', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}/maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return maintenance history array', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}/maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 9 -- Delete Machine (Admin) ----------------------------------------

describe('Machines: Delete (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/machines/${machineId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created ID and fall back to existing machine
    _createdMachineId = 0;
    if (_existingMachineId) {
      machineId = _existingMachineId;
    }
  });
});
