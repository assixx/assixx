/**
 * Shift Swap Requests — API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests the full swap request lifecycle including settings, CRUD, and consent.
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

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- Tenant Setting ---------------------------------------------------

describe('Swap Requests: Tenant Setting', () => {
  it('GET /organigram/swap-requests-enabled should return 200', async () => {
    const res = await fetch(`${BASE_URL}/organigram/swap-requests-enabled`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.swapRequestsEnabled).toBe('boolean');
  });

  it('PATCH /organigram/swap-requests-enabled should enable (root)', async () => {
    const res = await fetch(`${BASE_URL}/organigram/swap-requests-enabled`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ enabled: true }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.swapRequestsEnabled).toBe(true);
  });
});

// ---- Unauthenticated --------------------------------------------------

describe('Swap Requests: Auth', () => {
  it('should return 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests`);
    expect(res.status).toBe(401);
  });
});

// ---- List + My Consents ------------------------------------------------

describe('Swap Requests: List', () => {
  it('GET /shifts/swap-requests should return 200', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /shifts/swap-requests?status=pending_partner should accept new status enum', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests?status=pending_partner`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('GET /shifts/swap-requests/my-consents should return 200 with array', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests/my-consents`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- Create Validation -------------------------------------------------

describe('Swap Requests: Create Validation', () => {
  it('POST /shifts/swap-requests with empty body should return 400', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /shifts/swap-requests with nonexistent shifts should return 404', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        requesterShiftId: 999999,
        targetShiftId: 999998,
        targetId: 999997,
        swapScope: 'single_day',
        startDate: '2026-04-10',
        endDate: '2026-04-10',
      }),
    });

    // 404 (shift not found) or 403 (shift not owned)
    expect([403, 404]).toContain(res.status);
  });
});

// ---- UUID Endpoints (nonexistent) --------------------------------------

describe('Swap Requests: UUID Endpoints', () => {
  const fakeUuid = '00000000-0000-0000-0000-000000000000';

  it('GET /shifts/swap-requests/uuid/:uuid should return 404 for nonexistent', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests/uuid/${fakeUuid}`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });

  it('POST /shifts/swap-requests/uuid/:uuid/respond should return 404 for nonexistent', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests/uuid/${fakeUuid}/respond`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ accept: true }),
    });

    expect(res.status).toBe(404);
  });

  it('POST /shifts/swap-requests/uuid/:uuid/cancel should return 404 for nonexistent', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests/uuid/${fakeUuid}/cancel`, {
      method: 'POST',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

// ---- Legacy Endpoint ---------------------------------------------------

describe('Swap Requests: Legacy Endpoint', () => {
  it('PUT /shifts/swap-requests/:id/status should still work (legacy)', async () => {
    const res = await fetch(`${BASE_URL}/shifts/swap-requests/1/status`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'approved' }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.message).toContain('use new swap endpoints');
  });
});
