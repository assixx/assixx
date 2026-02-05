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
