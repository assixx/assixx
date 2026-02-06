/**
 * Departments API Integration Tests
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

/** ID of department created during this test run -- used by get/update/delete */
let departmentId: number;

/** Fallback ID captured from list endpoint -- restored after delete cleanup */
let _existingDepartmentId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Departments ---------------------------------------------

describe('Departments: List Departments', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/departments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return departments array', async () => {
    const res = await fetch(`${BASE_URL}/departments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Store first existing department ID as fallback
    if (Array.isArray(body.data) && body.data.length > 0) {
      _existingDepartmentId = body.data[0].id as number;
    }
  });
});

// ---- seq: 2 -- Create Department (Admin) ------------------------------------

describe('Departments: Create Department (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Dept ${Date.now()}`,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created department with ID', async () => {
    const res = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test Dept ${Date.now()}`,
        description: 'Created via API test - will be deleted',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');

    // Store created department ID for subsequent tests
    departmentId = body.data.id as number;
  });
});

// ---- seq: 3 -- Get Department by ID -----------------------------------------

describe('Departments: Get Department by ID', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/departments/${departmentId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return department object', async () => {
    const res = await fetch(`${BASE_URL}/departments/${departmentId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });
});

// ---- seq: 4 -- Update Department (Admin) ------------------------------------

describe('Departments: Update Department (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/departments/${departmentId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Updated Dept ${Date.now()}`,
        description: 'Updated via API test',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Delete Department (Admin) ------------------------------------

describe('Departments: Delete Department (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/departments/${departmentId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should confirm deletion', async () => {
    // Create a fresh department to delete (the previous test already deleted departmentId)
    const createRes = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Delete Dept ${Date.now()}`,
        description: 'Created for deletion confirmation test',
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;
    const deleteDeptId = createBody.data.id as number;

    const res = await fetch(`${BASE_URL}/departments/${deleteDeptId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.success).toBe(true);

    // Cleanup: restore fallback ID
    if (_existingDepartmentId) {
      departmentId = _existingDepartmentId;
    }
  });
});
