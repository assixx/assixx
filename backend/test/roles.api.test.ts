/**
 * Roles API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import { type AuthState, BASE_URL, type JsonBody, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Roles ---------------------------------------------------

describe('Roles: List Roles', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/roles`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return roles array', async () => {
    const res = await fetch(`${BASE_URL}/roles`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 2 -- Get Role Hierarchy -------------------------------------------

describe('Roles: Get Role Hierarchy', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/roles/hierarchy`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 3 -- Get Assignable Roles -----------------------------------------

describe('Roles: Get Assignable Roles', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/roles/assignable`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
