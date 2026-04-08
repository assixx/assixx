/**
 * Inventory API Integration Tests
 *
 * Tests the full inventory addon lifecycle against the running Docker backend.
 * Requires: Docker stack running, inventory addon activated (via 00-auth setup).
 *
 * Covers: Lists CRUD, Items CRUD (auto-code), Custom Fields, Categories,
 *         Cross-Tenant FK Injection (RLS regression), Granular Permissions
 *         (ADR-020), Custom Value Type Validation, Audit Logging (root_logs).
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  ensureTestEmployee,
  fetchWithRetry,
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

// ── Helpers for new test blocks (cross-tenant, permissions, audit) ──

interface ForeignTenantState {
  tenantId: number;
  listUuid: string;
}

/**
 * Insert a foreign tenant + inventory_list directly via SQL (assixx_user, BYPASSRLS).
 *
 * Idempotent: subdomain UNIQUE constraint → re-runs reuse the same tenant row.
 * The list itself gets a fresh UUID per call so each test run gets a clean
 * row to attack. created_by points at the apitest admin user — that's a plain
 * FK with no tenant validation, so RLS isolation still works as expected.
 */
function ensureForeignTenantWithList(createdByUserId: number): ForeignTenantState {
  const sql = [
    'INSERT INTO tenants (company_name, subdomain, email, uuid, uuid_created_at)',
    "VALUES ('Foreign Inv Test GmbH', 'foreigninv', 'info@foreigninv.de',",
    '        gen_random_uuid()::char(36), NOW())',
    'ON CONFLICT (subdomain) DO NOTHING;',
    'WITH t AS (SELECT id FROM tenants WHERE subdomain = ' + "'foreigninv'" + ' LIMIT 1)',
    'INSERT INTO inventory_lists',
    '  (id, tenant_id, title, description, code_prefix, code_separator,',
    '   code_digits, next_number, created_by, is_active)',
    'SELECT gen_random_uuid(), t.id, ' +
      "'Foreign FK Injection List', 'Cross-tenant test', 'XFK', '-', 3, 1, " +
      String(createdByUserId) +
      ', 1',
    'FROM t',
    'RETURNING id::text, tenant_id;',
  ].join(' ');
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -tA -F '|' -c "${sql}"`,
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
    .toString()
    .trim();
  const lines = out.split('\n').filter((l: string): boolean => l.includes('|'));
  const last = lines[lines.length - 1];
  if (last === undefined) {
    throw new Error(`ensureForeignTenantWithList: no row returned (got: ${JSON.stringify(out)})`);
  }
  const [listId, tenantIdStr] = last.split('|');
  if (listId === undefined || tenantIdStr === undefined) {
    throw new Error(`ensureForeignTenantWithList: malformed row "${last}"`);
  }
  return { listUuid: listId, tenantId: Number(tenantIdStr) };
}

/** Delete all inventory_lists rows for the foreign test tenant. */
function cleanupForeignTenantData(): void {
  execSync(
    'docker exec assixx-postgres psql -U assixx_user -d assixx -c "' +
      'DELETE FROM inventory_lists WHERE tenant_id = ' +
      "(SELECT id FROM tenants WHERE subdomain = 'foreigninv');\"",
    { stdio: 'pipe' },
  );
}

interface PermissionGrant {
  addonCode: string;
  moduleCode: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** PUT user-permissions as root. Throws on non-2xx. */
async function setUserPermissions(
  rootToken: string,
  userUuid: string,
  permissions: PermissionGrant[],
): Promise<void> {
  const res = await fetch(`${BASE_URL}/user-permissions/${userUuid}`, {
    method: 'PUT',
    headers: authHeaders(rootToken),
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) {
    throw new Error(`setUserPermissions failed: ${String(res.status)}`);
  }
}

/** Login as a non-cached user (employee). Returns access token only. */
async function loginAs(email: string, password: string): Promise<string> {
  const res = await fetchWithRetry(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`loginAs(${email}) failed: ${String(res.status)}`);
  }
  const body = (await res.json()) as JsonBody;
  return body.data.accessToken as string;
}

interface RootLogEntry {
  action: string;
  entity_type: string;
  details: string;
}

/**
 * Read recent root_logs entries for a tenant + entity_type via psql.
 * Returns the rows as parsed JSON — robust against pipes/newlines in details.
 */
function fetchRootLogs(tenantId: number, entityType: string, limit: number): RootLogEntry[] {
  const sql =
    "SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json)::text FROM (" +
    "  SELECT action, entity_type, COALESCE(details, '') AS details" +
    '  FROM root_logs' +
    '  WHERE tenant_id = ' +
    String(tenantId) +
    "    AND entity_type = '" +
    entityType +
    "'" +
    '  ORDER BY created_at DESC' +
    '  LIMIT ' +
    String(limit) +
    ') sub;';
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -tA -c "${sql}"`,
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
    .toString()
    .trim();
  if (out === '' || out === '[]') return [];
  return JSON.parse(out) as RootLogEntry[];
}

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

// ── Cross-Tenant FK Injection (RLS Regression) ──────────────────
//
// Threat: an attacker tries to attach a new item to a list belonging to
// a different tenant by passing the foreign list's UUID. The service
// SELECTs the list FOR UPDATE inside tenantTransaction → RLS filters
// cross-tenant rows → list "not found" → 404. NEVER 201.
//
// This is a regression test: if RLS is ever weakened or the SELECT is
// replaced with a non-tenant-scoped query, this test catches it.

describe('Inventory: Cross-Tenant FK Injection (RLS Regression)', () => {
  let foreignListUuid: string;

  beforeAll(() => {
    const state = ensureForeignTenantWithList(auth.userId);
    foreignListUuid = state.listUuid;
  });

  afterAll(() => {
    cleanupForeignTenantData();
  });

  it('should reject POST /items with a foreign-tenant listId (404, not 201)', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: foreignListUuid,
        name: 'Cross-tenant attack item',
      }),
    });

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(201);
  });

  it('should return 404 on GET /lists/:id for a foreign-tenant list', async () => {
    const res = await fetch(`${API}/lists/${foreignListUuid}`, {
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(404);
  });

  it('should not include the foreign list in GET /lists', async () => {
    const res = await fetch(`${API}/lists`, {
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    const lists = body.data as Array<{ id: string }>;
    expect(lists.find((l: { id: string }): boolean => l.id === foreignListUuid)).toBeUndefined();
  });
});

// ── Granular Permissions (ADR-020) ──────────────────────────────
//
// Verifies that @RequirePermission decorators on the inventory controller
// honor canRead/canWrite/canDelete granularity per module. Three sub-blocks:
//   1. NO permissions   → all access denied
//   2. canRead only     → reads pass, writes/deletes denied
//   3. canRead+canWrite → reads/writes pass, delete denied
//   4. cross-module     → permissions on inventory-items don't grant
//                         access to inventory-lists endpoints
//
// Without these tests, a future refactor that drops or relaxes a decorator
// would silently leak privilege.

describe('Inventory: Granular Permissions (ADR-020)', () => {
  let employeeUuid: string;
  let employeeToken: string;
  let permListId: string;
  let permItemId: string;

  // PUT /user-permissions schema requires permissions.min(1). Sending [] would
  // 400. The service is also UPSERT-per-(addon,module): tuples NOT in the body
  // remain unchanged from previous calls. So both "revoke everything" AND
  // "isolate to one module" must explicitly send false-rows for ALL modules
  // we previously touched — otherwise leftover state from a prior sub-block
  // leaks across.
  const ALL_FALSE_INVENTORY: PermissionGrant[] = [
    {
      addonCode: 'inventory',
      moduleCode: 'inventory-lists',
      canRead: false,
      canWrite: false,
      canDelete: false,
    },
    {
      addonCode: 'inventory',
      moduleCode: 'inventory-items',
      canRead: false,
      canWrite: false,
      canDelete: false,
    },
  ];

  beforeAll(async () => {
    await ensureTestEmployee(auth.authToken);

    const usersRes = await fetch(`${BASE_URL}/users?limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const usersBody = (await usersRes.json()) as JsonBody;
    const employee = (usersBody.data as Array<{ email: string; uuid: string }>).find(
      (u: { email: string }): boolean => u.email === 'employee@apitest.de',
    );
    if (employee?.uuid === undefined) {
      throw new Error('Test employee uuid missing');
    }
    employeeUuid = employee.uuid;
    employeeToken = await loginAs('employee@apitest.de', APITEST_PASSWORD);

    // Create a list + item AS ROOT to operate on
    const listRes = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Permission Test List',
        codePrefix: 'PRM',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });
    permListId = ((await listRes.json()) as JsonBody).data.id as string;

    const itemRes = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ listId: permListId, name: 'Permission Test Item' }),
    });
    permItemId = ((await itemRes.json()) as JsonBody).data.id as string;
  });

  afterAll(async () => {
    // Revoke all inventory permissions on the test employee
    await setUserPermissions(auth.authToken, employeeUuid, ALL_FALSE_INVENTORY);
    if (permItemId !== undefined) {
      await fetch(`${API}/items/${permItemId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
    if (permListId !== undefined) {
      await fetch(`${API}/lists/${permListId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  describe('Employee with NO inventory permissions', () => {
    beforeAll(async () => {
      await setUserPermissions(auth.authToken, employeeUuid, ALL_FALSE_INVENTORY);
    });

    it('should reject GET /lists with 403', async () => {
      const res = await fetch(`${API}/lists`, { headers: authOnly(employeeToken) });
      expect(res.status).toBe(403);
    });

    it('should reject POST /items with 403', async () => {
      const res = await fetch(`${API}/items`, {
        method: 'POST',
        headers: authHeaders(employeeToken),
        body: JSON.stringify({ listId: permListId, name: 'Should not create' }),
      });
      expect(res.status).toBe(403);
    });

    it('should reject DELETE /items/:uuid with 403', async () => {
      const res = await fetch(`${API}/items/${permItemId}`, {
        method: 'DELETE',
        headers: authOnly(employeeToken),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Employee with canRead only', () => {
    beforeAll(async () => {
      await setUserPermissions(auth.authToken, employeeUuid, [
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-lists',
          canRead: true,
          canWrite: false,
          canDelete: false,
        },
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-items',
          canRead: true,
          canWrite: false,
          canDelete: false,
        },
      ]);
    });

    it('should allow GET /lists (200)', async () => {
      const res = await fetch(`${API}/lists`, { headers: authOnly(employeeToken) });
      expect(res.status).toBe(200);
    });

    it('should allow GET /items?listId (200)', async () => {
      const res = await fetch(`${API}/items?listId=${permListId}`, {
        headers: authOnly(employeeToken),
      });
      expect(res.status).toBe(200);
    });

    it('should reject POST /items (403, no canWrite)', async () => {
      const res = await fetch(`${API}/items`, {
        method: 'POST',
        headers: authHeaders(employeeToken),
        body: JSON.stringify({ listId: permListId, name: 'Should not create' }),
      });
      expect(res.status).toBe(403);
    });

    it('should reject PATCH /items/:uuid (403, no canWrite)', async () => {
      const res = await fetch(`${API}/items/${permItemId}`, {
        method: 'PATCH',
        headers: authHeaders(employeeToken),
        body: JSON.stringify({ name: 'Should not patch' }),
      });
      expect(res.status).toBe(403);
    });

    it('should reject DELETE /items/:uuid (403, no canDelete)', async () => {
      const res = await fetch(`${API}/items/${permItemId}`, {
        method: 'DELETE',
        headers: authOnly(employeeToken),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Employee with canRead + canWrite (no canDelete)', () => {
    beforeAll(async () => {
      await setUserPermissions(auth.authToken, employeeUuid, [
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-lists',
          canRead: true,
          canWrite: true,
          canDelete: false,
        },
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-items',
          canRead: true,
          canWrite: true,
          canDelete: false,
        },
      ]);
    });

    it('should allow PATCH /items/:uuid (200, has canWrite)', async () => {
      const res = await fetch(`${API}/items/${permItemId}`, {
        method: 'PATCH',
        headers: authHeaders(employeeToken),
        body: JSON.stringify({ name: 'Renamed by employee' }),
      });
      expect(res.status).toBe(200);
    });

    it('should reject DELETE /items/:uuid (403, no canDelete)', async () => {
      const res = await fetch(`${API}/items/${permItemId}`, {
        method: 'DELETE',
        headers: authOnly(employeeToken),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Cross-module isolation', () => {
    beforeAll(async () => {
      // UPSERT semantics: tuples NOT in the body are not touched. The previous
      // sub-block ("canRead+canWrite") left inventory-lists.canRead = true on
      // this employee. We must explicitly reset inventory-lists to all false,
      // otherwise the GET /lists assertion below would 200 instead of 403.
      await setUserPermissions(auth.authToken, employeeUuid, [
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-lists',
          canRead: false,
          canWrite: false,
          canDelete: false,
        },
        {
          addonCode: 'inventory',
          moduleCode: 'inventory-items',
          canRead: true,
          canWrite: true,
          canDelete: true,
        },
      ]);
    });

    it('should allow GET /items (has inventory-items.canRead)', async () => {
      const res = await fetch(`${API}/items?listId=${permListId}`, {
        headers: authOnly(employeeToken),
      });
      expect(res.status).toBe(200);
    });

    it('should reject GET /lists (no inventory-lists.canRead)', async () => {
      const res = await fetch(`${API}/lists`, { headers: authOnly(employeeToken) });
      expect(res.status).toBe(403);
    });
  });
});

// ── Custom Value Type Validation (API end-to-end) ───────────────
//
// Service-level Zod (CustomValueInputSchema) only validates form, not
// type/required/select-options consistency against the field definition.
// validateCustomValues() in inventory-items.service.ts is the
// defense-in-depth check this block exercises end-to-end.

describe('Inventory: Custom Value Type Validation', () => {
  let typedListId: string;
  let textFieldId: string;
  let numberFieldId: string;
  let selectFieldId: string;

  beforeAll(async () => {
    const listRes = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Type Validation List',
        codePrefix: 'TVL',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });
    typedListId = ((await listRes.json()) as JsonBody).data.id as string;

    const textRes = await fetch(`${API}/lists/${typedListId}/fields`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fieldName: 'Beschreibung',
        fieldType: 'text',
        isRequired: true,
        sortOrder: 0,
      }),
    });
    textFieldId = ((await textRes.json()) as JsonBody).data.id as string;

    const numRes = await fetch(`${API}/lists/${typedListId}/fields`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fieldName: 'Tragkraft',
        fieldType: 'number',
        fieldUnit: 'kg',
        isRequired: false,
        sortOrder: 1,
      }),
    });
    numberFieldId = ((await numRes.json()) as JsonBody).data.id as string;

    const selRes = await fetch(`${API}/lists/${typedListId}/fields`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fieldName: 'Zustand',
        fieldType: 'select',
        fieldOptions: ['gut', 'mittel', 'schlecht'],
        isRequired: false,
        sortOrder: 2,
      }),
    });
    selectFieldId = ((await selRes.json()) as JsonBody).data.id as string;
  });

  afterAll(async () => {
    if (typedListId !== undefined) {
      await fetch(`${API}/lists/${typedListId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  it('should reject valueText for a number field (400)', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: typedListId,
        name: 'Wrong type item',
        customValues: [
          { fieldId: textFieldId, valueText: 'present' },
          { fieldId: numberFieldId, valueText: 'not-a-number' },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject required field with no value (400)', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: typedListId,
        name: 'Missing required item',
        customValues: [{ fieldId: textFieldId }, { fieldId: numberFieldId, valueNumber: 500 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject select value not in field_options (400)', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: typedListId,
        name: 'Invalid select item',
        customValues: [
          { fieldId: textFieldId, valueText: 'present' },
          { fieldId: selectFieldId, valueText: 'kaputt' },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should accept valid mixed-type values (201)', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: typedListId,
        name: 'Valid item',
        customValues: [
          { fieldId: textFieldId, valueText: 'Beschreibung-Wert' },
          { fieldId: numberFieldId, valueNumber: 1000 },
          { fieldId: selectFieldId, valueText: 'gut' },
        ],
      }),
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as JsonBody;
    const createdItemId = body.data.id as string;
    await fetch(`${API}/items/${createdItemId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });
});

// ── Audit Logging (root_logs) ───────────────────────────────────
//
// Phase 6 DoD claimed "audit logging works end-to-end" — but no test
// verified entries were actually written. This block reads root_logs
// directly via psql to confirm activityLogger.log() side effects.

describe('Inventory: Audit Logging (root_logs)', () => {
  let auditListId: string;
  let auditItemId: string;

  /** Fire-and-forget logging needs a brief delay to flush before we read. */
  async function flushLog(): Promise<void> {
    await new Promise<void>((resolve: (value: void) => void): void => {
      setTimeout(resolve, 250);
    });
  }

  it('should write a root_logs entry on list create', async () => {
    const res = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Audit Log Test List',
        codePrefix: 'ALT',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });
    expect(res.status).toBe(201);
    auditListId = ((await res.json()) as JsonBody).data.id as string;

    await flushLog();
    const logs = fetchRootLogs(auth.tenantId, 'inventory_list', 10);
    const match = logs.find(
      (l: RootLogEntry): boolean =>
        l.action === 'create' && l.details.includes('Audit Log Test List'),
    );
    expect(match).toBeDefined();
  });

  it('should write a root_logs entry on item create', async () => {
    const res = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ listId: auditListId, name: 'Audit Log Test Item' }),
    });
    expect(res.status).toBe(201);
    auditItemId = ((await res.json()) as JsonBody).data.id as string;

    await flushLog();
    const logs = fetchRootLogs(auth.tenantId, 'inventory_item', 10);
    const match = logs.find(
      (l: RootLogEntry): boolean =>
        l.action === 'create' && l.details.includes('Audit Log Test Item'),
    );
    expect(match).toBeDefined();
  });

  it('should write a root_logs entry on item update (incl. status change)', async () => {
    const res = await fetch(`${API}/items/${auditItemId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'maintenance' }),
    });
    expect(res.status).toBe(200);

    await flushLog();
    const logs = fetchRootLogs(auth.tenantId, 'inventory_item', 10);
    const match = logs.find(
      (l: RootLogEntry): boolean =>
        l.action === 'update' && l.details.includes('Audit Log Test Item'),
    );
    expect(match).toBeDefined();
  });

  it('should write a root_logs entry on item delete', async () => {
    const res = await fetch(`${API}/items/${auditItemId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(200);
    auditItemId = undefined as unknown as string;

    await flushLog();
    const logs = fetchRootLogs(auth.tenantId, 'inventory_item', 10);
    const match = logs.find((l: RootLogEntry): boolean => l.action === 'delete');
    expect(match).toBeDefined();
  });

  afterAll(async () => {
    if (auditItemId !== undefined) {
      await fetch(`${API}/items/${auditItemId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
    if (auditListId !== undefined) {
      await fetch(`${API}/lists/${auditListId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });
});

// ── ON CONFLICT Update Path Regression ─────────────────────────
//
// Migration 20260406123459751 dropped the original
//   UNIQUE(tenant_id, item_id, field_id)
// constraint on inventory_custom_values and replaced it with a
// PARTIAL unique index (WHERE is_active != 4) so soft-deleted rows
// can free their slot. Postgres' ON CONFLICT (cols) DO UPDATE clause
// can only use a partial index as arbiter when the WHERE clause is
// repeated EXACTLY in the conflict target. The original
// upsertCustomValues() did NOT repeat the clause, so any second write
// to the same (item_id, field_id) crashed with:
//   error: there is no unique or exclusion constraint matching the
//   ON CONFLICT specification
// The "valid mixed-types" test in the previous block only exercises
// the INSERT path (fresh item, no existing row → no conflict), which
// passes even WITHOUT ON CONFLICT and therefore CANNOT catch this
// regression. This block specifically targets the UPDATE path: PATCH
// the same fieldId twice with different values. If anyone removes the
// `WHERE is_active != ${IS_ACTIVE.DELETED}` clause from the service
// in the future, the first PATCH below crashes with 500.
//
// Fixed in inventory-items.service.ts:upsertCustomValues (2026-04-08).

describe('Inventory: Custom Value UPDATE Path (ON CONFLICT regression)', () => {
  let updateListId: string;
  let updateFieldId: string;
  let updateItemId: string;

  beforeAll(async () => {
    const listRes = await fetch(`${API}/lists`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Update Path Regression List',
        codePrefix: 'UPP',
        codeSeparator: '-',
        codeDigits: 3,
      }),
    });
    if (listRes.status !== 201) {
      throw new Error(`Setup failed: list create returned ${String(listRes.status)}`);
    }
    updateListId = ((await listRes.json()) as JsonBody).data.id as string;

    const fieldRes = await fetch(`${API}/lists/${updateListId}/fields`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fieldName: 'Notiz',
        fieldType: 'text',
        isRequired: false,
        sortOrder: 0,
      }),
    });
    if (fieldRes.status !== 201) {
      throw new Error(`Setup failed: field create returned ${String(fieldRes.status)}`);
    }
    updateFieldId = ((await fieldRes.json()) as JsonBody).data.id as string;

    // Create item WITH initial custom value — this writes the row that
    // subsequent PATCH calls will try to UPDATE (triggering ON CONFLICT).
    const itemRes = await fetch(`${API}/items`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        listId: updateListId,
        name: 'Update path item',
        customValues: [{ fieldId: updateFieldId, valueText: 'initial value' }],
      }),
    });
    if (itemRes.status !== 201) {
      throw new Error(`Setup failed: item create returned ${String(itemRes.status)}`);
    }
    updateItemId = ((await itemRes.json()) as JsonBody).data.id as string;
  });

  afterAll(async () => {
    if (updateItemId !== undefined) {
      await fetch(`${API}/items/${updateItemId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
    if (updateListId !== undefined) {
      await fetch(`${API}/lists/${updateListId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  it('should update existing custom value via PATCH (triggers ON CONFLICT DO UPDATE)', async () => {
    const res = await fetch(`${API}/items/${updateItemId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        customValues: [{ fieldId: updateFieldId, valueText: 'updated value' }],
      }),
    });
    expect(res.status).toBe(200);

    // Verify by re-fetching: the value must be UPDATED (not duplicated).
    // If the partial-index WHERE clause is missing from ON CONFLICT, the
    // PATCH above already crashed with 500 — but if the conflict logic
    // ever degrades silently to inserting a second row instead of
    // updating, this length-1 assertion catches that too.
    const detailRes = await fetch(`${API}/items/${updateItemId}`, {
      headers: authOnly(auth.authToken),
    });
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as JsonBody;
    const cvs = detailBody.data.customValues as Array<{
      fieldId: string;
      valueText: string | null;
    }>;
    const matching = cvs.filter((v: { fieldId: string }): boolean => v.fieldId === updateFieldId);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.valueText).toBe('updated value');
  });

  it('should handle a second PATCH on the same field (idempotent ON CONFLICT)', async () => {
    const res = await fetch(`${API}/items/${updateItemId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        customValues: [{ fieldId: updateFieldId, valueText: 'second update' }],
      }),
    });
    expect(res.status).toBe(200);

    const detailRes = await fetch(`${API}/items/${updateItemId}`, {
      headers: authOnly(auth.authToken),
    });
    const detailBody = (await detailRes.json()) as JsonBody;
    const cvs = detailBody.data.customValues as Array<{
      fieldId: string;
      valueText: string | null;
    }>;
    const matching = cvs.filter((v: { fieldId: string }): boolean => v.fieldId === updateFieldId);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.valueText).toBe('second update');
  });
});
