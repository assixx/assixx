/**
 * Settings API Integration Tests
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

// ---- seq: 1 -- Get System Settings ------------------------------------------

describe('Settings: System', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/settings/system`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 2 -- Get Tenant Settings ------------------------------------------

describe('Settings: Tenant', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/settings/tenant`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 3 -- Get User Settings --------------------------------------------

describe('Settings: User', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/settings/user`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 4 -- Get Settings Categories --------------------------------------

describe('Settings: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/settings/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
