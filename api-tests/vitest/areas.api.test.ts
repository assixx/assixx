/**
 * Areas API Integration Tests
 *
 * Migrated from Bruno CLI: api-tests/areas/*.bru
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authOnly, loginBrunotest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginBrunotest();
});

// ---- seq: 1 -- List Areas -----------------------------------------------------

describe('Areas: List Areas', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/areas`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return areas array', async () => {
    const res = await fetch(`${BASE_URL}/areas`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 2 -- Get Area Statistics --------------------------------------------

describe('Areas: Get Area Statistics', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/areas/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
