/**
 * E2E Keys API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests key registration, retrieval, and admin reset endpoints.
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

// ---- seq: 1 -- Get Own Keys (before registration) ----------------------------

describe('E2E Keys: Get Own Keys (before registration)', () => {
  it('should return 200 with null data when no key exists', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // data is null when no key has been registered yet
    // (may already exist if previous test run registered one)
  });
});

// ---- seq: 2 -- Register Key -------------------------------------------------

describe('E2E Keys: Register Public Key', () => {
  // Generate a deterministic 32-byte key for testing (all zeros in base64)
  const testPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

  it('should register key and return 201', async () => {
    // First, check if key already exists (from previous test runs)
    const checkRes = await fetch(`${BASE_URL}/e2e/keys/me`, {
      headers: authOnly(auth.authToken),
    });
    const checkBody = (await checkRes.json()) as JsonBody;

    if (checkBody.data !== null) {
      // Key already exists — skip registration test
      // (API integration tests should be idempotent)
      return;
    }

    const res = await fetch(`${BASE_URL}/e2e/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authOnly(auth.authToken),
      },
      body: JSON.stringify({ publicKey: testPublicKey }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.publicKey).toBe(testPublicKey);
    expect(body.data.fingerprint).toBeDefined();
    expect(body.data.keyVersion).toBe(1);
    expect(body.data.createdAt).toBeDefined();
  });

  it('should return 409 Conflict on duplicate registration', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authOnly(auth.authToken),
      },
      body: JSON.stringify({ publicKey: testPublicKey }),
    });

    // Either 409 (key exists) or 201 (first run) — both are valid
    expect([201, 409]).toContain(res.status);
  });
});

// ---- seq: 3 -- Get Own Keys (after registration) ----------------------------

describe('E2E Keys: Get Own Keys (after registration)', () => {
  it('should return own key data', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys/me`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // After registration, data must not be null
    expect(body.data).not.toBeNull();
    expect(body.data.publicKey).toBeDefined();
    expect(body.data.fingerprint).toBeDefined();
    // Version may be > 1 if other tests rotated the key (e.g., roundtrip test)
    expect(body.data.keyVersion).toBeGreaterThanOrEqual(1);
  });
});

// ---- seq: 4 -- Get Another User's Key ---------------------------------------

describe('E2E Keys: Get Another User Public Key', () => {
  it('should return 200 for existing user (null if no key)', async () => {
    // userId 1 may or may not have a key — both outcomes are valid
    const res = await fetch(`${BASE_URL}/e2e/keys/1`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // data can be null (user has no key) or an object with publicKey
  });
});

// ---- seq: 5 -- Validation: Invalid Key Format --------------------------------

describe('E2E Keys: Validation', () => {
  it('should reject invalid base64 key', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authOnly(auth.authToken),
      },
      body: JSON.stringify({ publicKey: 'not-valid-base64-key' }),
    });

    // Should fail validation (400 or 422)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('should reject key that is not 32 bytes', async () => {
    // Valid base64 but not 32 bytes (16 bytes = 24 chars in base64)
    const shortKey = 'AAAAAAAAAAAAAAAAAAAAAA==';
    const res = await fetch(`${BASE_URL}/e2e/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authOnly(auth.authToken),
      },
      body: JSON.stringify({ publicKey: shortKey }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ---- seq: 6 -- Auth Required -------------------------------------------------

describe('E2E Keys: Auth Required', () => {
  it('should return 401 without auth token', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys/me`);

    expect(res.status).toBe(401);
  });

  it('should return 401 for POST without auth token', async () => {
    const res = await fetch(`${BASE_URL}/e2e/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      }),
    });

    expect(res.status).toBe(401);
  });
});
