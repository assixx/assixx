/**
 * Documents API Integration Tests
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

// ---- seq: 1 -- List Documents -------------------------------------------------

describe('Documents: List Documents', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/documents`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return documents array', async () => {
    const res = await fetch(`${BASE_URL}/documents`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.documents).toBeDefined();
    expect(Array.isArray(body.data.documents)).toBe(true);
  });
});

// ---- seq: 2 -- List Chat Folders ----------------------------------------------

describe('Documents: List Chat Folders', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/documents/chat-folders`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return chat folders array', async () => {
    const res = await fetch(`${BASE_URL}/documents/chat-folders`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.folders).toBeDefined();
    expect(Array.isArray(body.data.folders)).toBe(true);
  });
});
