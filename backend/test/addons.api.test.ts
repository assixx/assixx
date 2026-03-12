/**
 * Addons API Integration Tests (ADR-033)
 *
 * Runs against REAL backend (Docker must be running).
 *
 * Covers the full addon lifecycle:
 *   - Public listing (no auth needed)
 *   - Tenant-specific addons with status
 *   - Core addon status (always active)
 *   - Activate/deactivate purchasable addon (trial lifecycle)
 *   - Addon gating (403 when disabled)
 *   - Reactivation restores access
 *   - Core addon rejection (cannot activate/deactivate)
 *   - Tenant summary with cost calculation
 *   - Unauthenticated access -> 401
 *
 * IMPORTANT: This file runs BEFORE vacation.api.test.ts (alphabetical order).
 * The re-activation at the end ensures vacation tests find the addon enabled.
 *
 * @see ADR-033 (Addon-based SaaS Model)
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

// ── seq: 1 — GET /addons (public, no auth) ──────────────────────────────────

describe('Addons: List all addons (public)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons`);
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK without authentication', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return an array of addons', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('should contain both core and purchasable addons', () => {
    const addons = body.data as Array<{ isCore: boolean }>;
    const hasCoreAddon = addons.some((a: { isCore: boolean }) => a.isCore);
    const hasPurchasable = addons.some((a: { isCore: boolean }) => !a.isCore);
    expect(hasCoreAddon).toBe(true);
    expect(hasPurchasable).toBe(true);
  });
});

// ── seq: 2 — GET /addons/my-addons ──────────────────────────────────────────

describe('Addons: My addons with tenant status', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/my-addons`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return addons with tenantStatus', () => {
    const addons = body.data as Array<{ tenantStatus: unknown }>;
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon).toHaveProperty('tenantStatus');
    }
  });
});

// ── seq: 3 — GET /addons/status/dashboard (core) ───────────────────────────

describe('Addons: Core addon status', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/status/dashboard`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should report core_always_active status', () => {
    expect(body.data.status).toBe('core_always_active');
    expect(body.data.isCore).toBe(true);
    expect(body.data.addonCode).toBe('dashboard');
  });
});

// ── seq: 4 — GET /addons/vacation ───────────────────────────────────────────

describe('Addons: Get addon by code', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/vacation`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return addon with required fields', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('code', 'vacation');
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('isCore', false);
  });
});

// ── seq: 5 — Unauthenticated → 401 ─────────────────────────────────────────

describe('Addons: Unauthenticated access', () => {
  it('should return 401 for my-addons without auth', async () => {
    const res = await fetch(`${BASE_URL}/addons/my-addons`);
    expect(res.status).toBe(401);
  });
});

// ── seq: 6 — Activate core addon → 400 ─────────────────────────────────────

describe('Addons: Activate core addon rejected', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/activate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'dashboard',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });

  it('should explain core addons are always active', () => {
    expect(body.error.message).toContain('core addon');
    expect(body.error.message).toContain('always active');
  });
});

// ── seq: 7 — Deactivate core addon → 400 ───────────────────────────────────

describe('Addons: Deactivate core addon rejected', () => {
  it('should return 400 for deactivating core addon', async () => {
    const res = await fetch(`${BASE_URL}/addons/deactivate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'dashboard',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(400);
    expect(body.error.message).toContain('core addon');
    expect(body.error.message).toContain('cannot be deactivated');
  });
});

// ── seq: 8 — Setup: ensure vacation deactivated ─────────────────────────────

describe('Addons: Ensure vacation is deactivated (setup)', () => {
  it('should deactivate vacation or confirm already inactive', async () => {
    const deactivateRes = await fetch(`${BASE_URL}/addons/deactivate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'vacation',
      }),
    });

    // 201 = deactivated, 404 = never activated → both OK
    expect([201, 404]).toContain(deactivateRes.status);

    // Verify: hasAccess must be false now
    const checkRes = await fetch(`${BASE_URL}/addons/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    const checkBody = (await checkRes.json()) as JsonBody;

    expect(checkRes.status).toBe(200);
    expect(checkBody.data.hasAccess).toBe(false);
  });
});

// ── seq: 9 — Activate vacation → trial ──────────────────────────────────────

describe('Addons: Activate vacation (purchasable -> trial)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/activate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'vacation',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return trial status with addon code', () => {
    expect(body.data.status).toBe('trial');
    expect(body.data.addonCode).toBe('vacation');
  });

  it('should include trial end date and days remaining', () => {
    expect(body.data.trialEndsAt).toBeDefined();
    expect(body.data.daysRemaining).toBeGreaterThan(0);
  });
});

// ── seq: 10 — Verify access after activation ────────────────────────────────

describe('Addons: Vacation accessible after activation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/test/vacation`, {
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

// ── seq: 11 — Deactivate vacation ───────────────────────────────────────────

describe('Addons: Deactivate vacation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/deactivate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'vacation',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return deactivation message', () => {
    expect(body.data.message).toContain('vacation');
    expect(body.data.message).toContain('deactivated');
  });
});

// ── seq: 12 — Verify NO access after deactivation ──────────────────────────

describe('Addons: Vacation not accessible after deactivation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/test/vacation`, {
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

// ── seq: 13 — Guarded endpoint → 403 ───────────────────────────────────────

describe('Addons: Guarded endpoint returns 403 when addon disabled', () => {
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
    expect(body.error.message).toContain(
      'vacation addon is not enabled for this tenant',
    );
  });
});

// ── seq: 14 — Reactivate vacation (cleanup for vacation.api.test.ts) ────────

describe('Addons: Reactivate vacation (cleanup)', () => {
  let activateRes: Response;
  let activateBody: JsonBody;
  let verifyRes: Response;
  let verifyBody: JsonBody;

  beforeAll(async () => {
    activateRes = await fetch(`${BASE_URL}/addons/activate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        tenantId: auth.tenantId,
        addonCode: 'vacation',
      }),
    });
    activateBody = (await activateRes.json()) as JsonBody;

    verifyRes = await fetch(`${BASE_URL}/addons/test/vacation`, {
      headers: authOnly(auth.authToken),
    });
    verifyBody = (await verifyRes.json()) as JsonBody;
  });

  it('should reactivate successfully with trial status', () => {
    expect(activateRes.status).toBe(201);
    expect(activateBody.success).toBe(true);
    expect(activateBody.data.status).toBe('trial');
  });

  it('should verify access is restored', () => {
    expect(verifyRes.status).toBe(200);
    expect(verifyBody.data.hasAccess).toBe(true);
  });
});

// ── seq: 15 — Tenant summary (tenant isolation) ────────────────────────────

describe('Addons: Tenant summary (tenant isolation)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/addons/tenant/${auth.tenantId}/summary`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return summary for correct tenant with all fields', () => {
    expect(body.data.tenantId).toBe(auth.tenantId);
    expect(body.data).toHaveProperty('coreAddons');
    expect(body.data).toHaveProperty('activeAddons');
    expect(body.data).toHaveProperty('trialAddons');
    expect(body.data).toHaveProperty('cancelledAddons');
    expect(body.data).toHaveProperty('monthlyCost');
    expect(body.data.coreAddons).toBeGreaterThan(0);
  });
});
