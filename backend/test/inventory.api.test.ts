/**
 * Inventory API Integration Tests
 *
 * Tests the full inventory addon lifecycle against the running Docker backend.
 * Requires: Docker stack running, inventory addon activated (via 00-auth setup).
 *
 * Covers: Lists CRUD, Items CRUD (auto-code), Custom Fields, Categories.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

const API = `${BASE_URL}/inventory`;

let auth: AuthState;

// Shared state across sequential tests
let listId: string;
let itemId: string;
let itemCode: string;
let fieldId: string;

beforeAll(async () => {
  auth = await loginApitest();
});

// ── Cleanup ─────────────────────────────────────────────────────

afterAll(async () => {
  // Soft-delete test data (items first, then lists — FK order)
  if (itemId !== undefined) {
    await fetch(`${API}/items/${itemId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
  if (listId !== undefined) {
    await fetch(`${API}/lists/${listId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
});

// ── Auth & Addon Gating ─────────────────────────────────────────

describe('Inventory: Auth & Addon Gating', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const res = await fetch(`${API}/lists`);
    expect(res.status).toBe(401);
  });

  it('should accept authenticated requests', async () => {
    const res = await fetch(`${API}/lists`, {
      headers: authOnly(auth.authToken),
    });
    // 200 if addon active, 403 if not — both prove auth passed
    expect([200, 403]).toContain(res.status);
  });
});

// ── Lists CRUD ──────────────────────────────────────────────────

describe('Inventory: Create List', () => {
  it('should create a list with 201', async () => {
    const res = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'API Test Kräne',
        description: 'Integrationstests',
        category: 'Lastaufnahmemittel',
        codePrefix: 'ATK',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonBody;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data.title).toBe('API Test Kräne');
    expect(body.data.code_prefix).toBe('ATK');

    listId = body.data.id as string;
  });

  it('should reject duplicate code prefix with 409', async () => {
    const res = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Duplicate Prefix',
        codePrefix: 'ATK',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });

    // idx_inventory_lists_unique_prefix unique violation must be mapped to
    // 409 Conflict by InventoryListsService.create — not leaked as a raw 500
    // via AllExceptionsFilter. Previously this assertion accepted 4xx/5xx;
    // hardened after the 500 → 409 fix to lock the contract.
    expect(res.status).toBe(409);
    const body = (await res.json()) as JsonBody;
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).toContain('ATK');
  });
});

describe('Inventory: Get Lists', () => {
  it('should return lists array with status counts', async () => {
    const res = await fetch(`${API}/lists`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const list = (body.data as JsonBody[]).find((l: JsonBody) => l.id === listId);
    expect(list).toBeDefined();
    expect(list?.statusCounts).toBeDefined();
    expect(list?.totalItems).toBe(0);
  });
});

describe('Inventory: Get List by ID', () => {
  it('should return list with custom fields', async () => {
    const res = await fetch(`${API}/lists/${listId}`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.list.id).toBe(listId);
    expect(Array.isArray(body.data.fields)).toBe(true);
  });

  it('should return 404 for nonexistent list', async () => {
    const res = await fetch(`${API}/lists/00000000-0000-0000-0000-000000000000`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

describe('Inventory: Update List', () => {
  it('should update list title', async () => {
    const res = await fetch(`${API}/lists/${listId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ title: 'API Test Kräne Updated' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.title).toBe('API Test Kräne Updated');
  });
});

// ── Custom Fields ───────────────────────────────────────────────

describe('Inventory: Custom Fields', () => {
  it('should add a custom field to the list', async () => {
    const res = await fetch(`${API}/lists/${listId}/fields`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fieldName: 'Tragkraft',
        fieldType: 'number',
        fieldUnit: 'kg',
        isRequired: true,
        sortOrder: 0,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonBody;
    expect(body.data.fieldName).toBe('Tragkraft');
    expect(body.data.fieldType).toBe('number');
    expect(body.data.fieldUnit).toBe('kg');

    fieldId = body.data.id as string;
  });

  it('should update a custom field', async () => {
    const res = await fetch(`${API}/fields/${fieldId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ fieldUnit: 't' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.fieldUnit).toBe('t');
  });
});

// ── Items CRUD ──────────────────────────────────────────────────

describe('Inventory: Create Item (Auto-Code)', () => {
  it('should create item with auto-generated code', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId,
        name: 'Brückenkran Halle A',
        description: 'API Test Item',
        status: 'operational',
        location: 'Halle A',
        manufacturer: 'Demag',
        serialNumber: 'SN-API-001',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonBody;
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('code');
    expect(body.data.code).toBe('ATK-001');
    expect(body.data.name).toBe('Brückenkran Halle A');

    itemId = body.data.id as string;
    itemCode = body.data.code as string;
  });

  it('should generate sequential codes', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId,
        name: 'Portalkran Halle B',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonBody;
    expect(body.data.code).toBe('ATK-002');

    // Clean up second item
    const secondId = body.data.id as string;
    await fetch(`${API}/items/${secondId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });
});

describe('Inventory: Get Items', () => {
  it('should return items filtered by listId', async () => {
    const res = await fetch(`${API}/items?listId=${listId}`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total');
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('should require listId parameter', async () => {
    const res = await fetch(`${API}/items`, {
      headers: authOnly(auth.authToken),
    });

    // Should fail validation — listId is required
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Inventory: Get Item by UUID (QR Target)', () => {
  it('should return item detail with photos and custom values', async () => {
    const res = await fetch(`${API}/items/${itemId}`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.item.id).toBe(itemId);
    expect(body.data.item.code).toBe(itemCode);
    expect(Array.isArray(body.data.photos)).toBe(true);
    expect(Array.isArray(body.data.customValues)).toBe(true);
  });

  it('should return 404 for nonexistent UUID', async () => {
    const res = await fetch(`${API}/items/00000000-0000-0000-0000-000000000000`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

describe('Inventory: Update Item', () => {
  it('should update item fields', async () => {
    const res = await fetch(`${API}/items/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Brückenkran Halle A (Updated)',
        status: 'maintenance',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.name).toBe('Brückenkran Halle A (Updated)');
    expect(body.data.status).toBe('maintenance');
  });
});

// ── Categories ──────────────────────────────────────────────────

describe('Inventory: Categories Autocomplete', () => {
  it('should return categories', async () => {
    const res = await fetch(`${API}/categories`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should filter categories by query', async () => {
    const res = await fetch(`${API}/categories?q=Last`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ── Delete ──────────────────────────────────────────────────────

describe('Inventory: Delete', () => {
  it('should soft-delete custom field', async () => {
    const res = await fetch(`${API}/fields/${fieldId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
  });

  it('should soft-delete item', async () => {
    const res = await fetch(`${API}/items/${itemId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    // Reset so afterAll doesn't try again
    itemId = undefined as unknown as string;
  });

  it('should soft-delete list', async () => {
    const res = await fetch(`${API}/lists/${listId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(200);
    listId = undefined as unknown as string;
  });
});
