/**
 * Features API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authOnly, loginApitest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Features ------------------------------------------------

describe('Features: List Features', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/features`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return features array', async () => {
    const res = await fetch(`${BASE_URL}/features`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 2 -- Get My Features ----------------------------------------------

describe('Features: My Features', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/features/my-features`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 3 -- Get Feature Categories ---------------------------------------

describe('Features: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/features/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
