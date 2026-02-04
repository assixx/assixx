/**
 * Teams API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authHeaders, authOnly, loginApitest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

/** Department created in beforeAll -- teams require a parent department */
let teamsDepartmentId: number;

/** ID of team created during this test run -- used by get/update/members/delete */
let teamId: number;

/** Fallback ID captured from list endpoint -- restored after delete cleanup */
let _existingTeamId: number;

beforeAll(async () => {
  auth = await loginApitest();

  // Teams require a department -- create one upfront
  const res = await fetch(`${BASE_URL}/departments`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      name: `Teams Test Dept ${Date.now()}`,
      description: 'Auto-created for teams integration tests',
    }),
  });
  const body = (await res.json()) as JsonBody;

  if (res.status === 201 && body.data?.id) {
    teamsDepartmentId = body.data.id as number;
  } else {
    // Fallback: fetch existing departments
    const listRes = await fetch(`${BASE_URL}/departments`, {
      headers: authOnly(auth.authToken),
    });
    const listBody = (await listRes.json()) as JsonBody;

    if (Array.isArray(listBody.data) && listBody.data.length > 0) {
      teamsDepartmentId = listBody.data[0].id as number;
    } else {
      throw new Error('Cannot run teams tests: no department available');
    }
  }
});

afterAll(async () => {
  // Cleanup: delete the department created for this test suite
  if (teamsDepartmentId) {
    await fetch(`${BASE_URL}/departments/${teamsDepartmentId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
});

// ---- seq: 1 -- List Teams ---------------------------------------------------

describe('Teams: List Teams', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return teams array', async () => {
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Store first existing team ID as fallback
    if (Array.isArray(body.data) && body.data.length > 0) {
      _existingTeamId = body.data[0].id as number;
    }
  });
});

// ---- seq: 2 -- Create Team (Admin) ------------------------------------------

describe('Teams: Create Team (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/teams`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Team ${Date.now()}`,
        departmentId: teamsDepartmentId,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created team with ID', async () => {
    const res = await fetch(`${BASE_URL}/teams`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Team ${Date.now()}`,
        departmentId: teamsDepartmentId,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');

    // Store created team ID for subsequent tests
    teamId = body.data.id as number;
  });
});

// ---- seq: 3 -- Get Team by ID -----------------------------------------------

describe('Teams: Get Team by ID', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return team object', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });
});

// ---- seq: 4 -- Update Team (Admin) ------------------------------------------

describe('Teams: Update Team (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Updated Team ${Date.now()}`,
        description: 'Updated via API test',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Get Team Members ---------------------------------------------

describe('Teams: Get Team Members', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}/members`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return members array', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}/members`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 6 -- Delete Team (Admin) ------------------------------------------

describe('Teams: Delete Team (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/teams/${teamId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should confirm deletion', async () => {
    // Create a fresh team to delete (the previous test already deleted teamId)
    const createRes = await fetch(`${BASE_URL}/teams`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Delete Team ${Date.now()}`,
        departmentId: teamsDepartmentId,
        description: 'Created for deletion confirmation test',
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;
    const deleteTeamId = createBody.data.id as number;

    const res = await fetch(`${BASE_URL}/teams/${deleteTeamId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.success).toBe(true);

    // Cleanup: restore fallback ID
    if (_existingTeamId) {
      teamId = _existingTeamId;
    }
  });
});
