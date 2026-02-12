/**
 * Features API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * Tests seq 4-10 cover the full feature activation lifecycle:
 *   - Ensure feature is NOT active (idempotent cleanup) → hasAccess: false
 *   - Activate → 201
 *   - Verify → hasAccess: true
 *   - Deactivate → 201
 *   - Verify → hasAccess: false
 *   - Guarded endpoint → 403 with correct error message
 *   - Re-activate (cleanup) → hasAccess: true
 *
 * IMPORTANT: This file runs BEFORE vacation.api.test.ts (alphabetical order).
 * The re-activation at the end ensures vacation tests find the feature enabled.
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

// ── seq: 4 — Setup: ensure vacation feature is NOT active ───────────────────

describe('Features: Ensure vacation is deactivated (setup)', () => {
  it('should deactivate vacation or confirm already inactive', async () => {
    // Idempotent: deactivate if active, ignore 404 if not in tenant_features
    const deactivateRes = await fetch(`${BASE_URL}/features/deactivate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        featureCode: 'vacation',
      }),
    });

    // 201 = deactivated, 404 = never activated for tenant — both OK
    expect([201, 404]).toContain(deactivateRes.status);

    // Verify: hasAccess must be false now
    const checkRes = await fetch(`${BASE_URL}/features/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    const checkBody = (await checkRes.json()) as JsonBody;

    expect(checkRes.status).toBe(200);
    expect(checkBody.data.hasAccess).toBe(false);
    expect(checkBody.data.featureCode).toBe('vacation');
  });
});

// ── seq: 5 — Activate vacation feature ──────────────────────────────────────

describe('Features: Activate vacation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/features/activate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        featureCode: 'vacation',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return success message', () => {
    expect(body.data.message).toContain('vacation');
    expect(body.data.message).toContain('activated');
  });
});

// ── seq: 6 — Verify access after activation ─────────────────────────────────

describe('Features: Vacation active after activation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/features/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should report hasAccess: true', () => {
    expect(body.data.hasAccess).toBe(true);
  });
});

// ── seq: 7 — Deactivate vacation feature ────────────────────────────────────

describe('Features: Deactivate vacation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/features/deactivate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        featureCode: 'vacation',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return success message', () => {
    expect(body.data.message).toContain('vacation');
    expect(body.data.message).toContain('deactivated');
  });
});

// ── seq: 8 — Verify NO access after deactivation ───────────────────────────

describe('Features: Vacation not active after deactivation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/features/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should report hasAccess: false', () => {
    expect(body.data.hasAccess).toBe(false);
  });
});

// ── seq: 9 — Guarded vacation endpoint returns 403 ─────────────────────────

describe('Features: Guarded endpoint returns 403 when feature disabled', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/vacation/settings`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 403 Forbidden', () => {
    expect(res.status).toBe(403);
  });

  it('should return correct error message', () => {
    expect(body.error.message).toContain('Vacation feature is not enabled');
  });
});

// ── seq: 10 — Re-activate vacation (cleanup for vacation.api.test.ts) ──────

describe('Features: Re-activate vacation (cleanup)', () => {
  let activateRes: Response;
  let activateBody: JsonBody;
  let verifyRes: Response;
  let verifyBody: JsonBody;

  beforeAll(async () => {
    activateRes = await fetch(`${BASE_URL}/features/activate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        featureCode: 'vacation',
      }),
    });
    activateBody = (await activateRes.json()) as JsonBody;

    verifyRes = await fetch(`${BASE_URL}/features/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    verifyBody = (await verifyRes.json()) as JsonBody;
  });

  it('should re-activate successfully', () => {
    expect(activateRes.status).toBe(201);
    expect(activateBody.success).toBe(true);
  });

  it('should verify access is restored', () => {
    expect(verifyRes.status).toBe(200);
    expect(verifyBody.data.hasAccess).toBe(true);
  });
});
