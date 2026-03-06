/**
 * Assets API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
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

// Shared state across sequential describe blocks
let assetId: number;
let _existingAssetId: number;
let _createdAssetId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Assets -------------------------------------------------

describe('Assets: List', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return assets array', async () => {
    const res = await fetch(`${BASE_URL}/assets`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Store first existing asset ID for fallback after delete
    if (body.data.length > 0) {
      _existingAssetId = body.data[0].id;
    }
  });
});

// ---- seq: 2 -- Create Asset (Admin) ----------------------------------------

describe('Assets: Create (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/assets`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `API Test ${Date.now()}`,
        model: 'TM-001',
        manufacturer: 'Test Corp',
        assetType: 'production',
        status: 'operational',
        location: 'Test Location',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    // Store created asset ID for subsequent tests
    if (body.data?.id) {
      assetId = body.data.id;
      _createdAssetId = body.data.id;
    }
  });
});

// ---- seq: 3 -- Get Asset by ID --------------------------------------------

describe('Assets: Get by ID', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return asset object with id and name', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });
});

// ---- seq: 4 -- Update Asset (Admin) ----------------------------------------

describe('Assets: Update (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Updated Asset Name',
        status: 'maintenance',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Get Asset Statistics ----------------------------------------

describe('Assets: Statistics', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/statistics`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return statistics with totalAssets', async () => {
    const res = await fetch(`${BASE_URL}/assets/statistics`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('totalAssets');
  });
});

// ---- seq: 6 -- Get Asset Categories ----------------------------------------

describe('Assets: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return categories array', async () => {
    const res = await fetch(`${BASE_URL}/assets/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 7 -- Get Upcoming Maintenance --------------------------------------

describe('Assets: Upcoming Maintenance', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/upcoming-maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return assets needing maintenance', async () => {
    const res = await fetch(`${BASE_URL}/assets/upcoming-maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 8 -- Get Maintenance History ---------------------------------------

describe('Assets: Maintenance History', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}/maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return maintenance history array', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}/maintenance`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 9 -- Delete Asset (Admin) ----------------------------------------

describe('Assets: Delete (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/assets/${assetId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created ID and fall back to existing asset
    _createdAssetId = 0;
    if (_existingAssetId) {
      assetId = _existingAssetId;
    }
  });
});
