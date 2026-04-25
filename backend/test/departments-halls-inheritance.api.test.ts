/**
 * Department Halls Inheritance API Tests
 *
 * Covers the additive Area-Hall inheritance model:
 * - Halls are implicitly assigned to a department via halls.area_id = dept.area_id.
 * - department_halls junction holds only CROSS-AREA halls (multi-building depts).
 *
 * Validates:
 * 1. Inherited halls show up with source='area' in GET /departments/:id.
 * 2. POST /departments/:id/halls rejects same-area halls with 400.
 * 3. Cross-area halls are accepted and appear with source='direct'.
 * 4. PUT /departments/:id area change cleans up now-redundant junction entries.
 * 5. POST /areas/:id/halls cleans up pre-existing junction rows that would become redundant.
 *
 * @see database/migrations/20260317222159593_department-halls-junction-table.ts
 *      (original design note: "departments inherit all halls from their area")
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

interface HallEntry {
  id: number;
  name: string;
  areaId: number | null;
  source: 'area' | 'direct';
}

interface DepartmentPayload {
  id: number;
  halls?: HallEntry[];
  hallCount?: number;
  areaId?: number | null;
}

let auth: AuthState;

// Resources created for this test run — cleaned up in afterAll.
let areaAId: number;
let areaBId: number;
let hallAId: number; // sits in Area A
let hallBId: number; // sits in Area B (cross-area relative to Dept-in-A)
let deptId: number; // lives in Area A

const ts = Date.now();

async function createOrFail(url: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify(body),
  });
  if (res.status !== 201) {
    throw new Error(`Setup failed: POST ${url} returned ${res.status.toString()}`);
  }
  return ((await res.json()) as JsonBody).data.id as number;
}

beforeAll(async () => {
  auth = await loginApitest();

  areaAId = await createOrFail(`${BASE_URL}/areas`, {
    name: `HallsInherit Area A ${ts}`,
    type: 'building',
  });
  areaBId = await createOrFail(`${BASE_URL}/areas`, {
    name: `HallsInherit Area B ${ts}`,
    type: 'building',
  });
  hallAId = await createOrFail(`${BASE_URL}/halls`, {
    name: `HallsInherit Hall A ${ts}`,
    areaId: areaAId,
  });
  hallBId = await createOrFail(`${BASE_URL}/halls`, {
    name: `HallsInherit Hall B ${ts}`,
    areaId: areaBId,
  });
  deptId = await createOrFail(`${BASE_URL}/departments`, {
    name: `HallsInherit Dept ${ts}`,
    areaId: areaAId,
    description: 'Auto-created for halls-inheritance integration tests',
  });
});

afterAll(async () => {
  // Best-effort cleanup (ignore 404/409)
  if (deptId) {
    await fetch(`${BASE_URL}/departments/${deptId}?force=true`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
  for (const hallId of [hallAId, hallBId]) {
    if (hallId) {
      await fetch(`${BASE_URL}/halls/${hallId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  }
  for (const areaId of [areaAId, areaBId]) {
    if (areaId) {
      await fetch(`${BASE_URL}/areas/${areaId}?force=true`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  }
});

// ---- Area-Inheritance: hall in dept.area_id appears as source='area' ---------

describe('Department Halls: Area inheritance', () => {
  it('GET /departments/:id returns Hall A with source=area (no junction entry needed)', async () => {
    const res = await fetch(`${BASE_URL}/departments/${deptId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const dept = body.data as DepartmentPayload;
    expect(Array.isArray(dept.halls)).toBe(true);

    const entry = dept.halls?.find((h) => h.id === hallAId);
    expect(entry).toBeDefined();
    expect(entry?.source).toBe('area');
    expect(dept.hallCount).toBeGreaterThanOrEqual(1);
  });
});

// ---- Validation: same-area halls cannot be explicitly assigned ---------------

describe('Department Halls: Same-area assignment rejection', () => {
  it('POST /departments/:id/halls with Hall A (same area) returns 400', async () => {
    const res = await fetch(`${BASE_URL}/departments/${deptId}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ hallIds: [hallAId] }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    // The error message mentions which hall is already inherited.
    const msg = typeof body.error === 'object' ? body.error.message : body.message;
    expect(String(msg)).toContain('Bereich');
  });
});

// ---- Cross-area assignment: direct source --------------------------------------

describe('Department Halls: Cross-area assignment', () => {
  it('POST /departments/:id/halls with Hall B succeeds', async () => {
    const res = await fetch(`${BASE_URL}/departments/${deptId}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ hallIds: [hallBId] }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /departments/:id now lists Hall B with source=direct and Hall A with source=area', async () => {
    const res = await fetch(`${BASE_URL}/departments/${deptId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    const dept = body.data as DepartmentPayload;

    const entryA = dept.halls?.find((h) => h.id === hallAId);
    const entryB = dept.halls?.find((h) => h.id === hallBId);

    expect(entryA?.source).toBe('area');
    expect(entryB?.source).toBe('direct');
    expect(dept.hallCount).toBe(2);
  });
});

// ---- Area change cleanup: dept moves into Area B, Hall B junction is now redundant

describe('Department Halls: Area change cleanup', () => {
  it('PUT /departments/:id changing area to Area B cleans up junction entry for Hall B', async () => {
    const putRes = await fetch(`${BASE_URL}/departments/${deptId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ areaId: areaBId }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${BASE_URL}/departments/${deptId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await getRes.json()) as JsonBody;
    const dept = body.data as DepartmentPayload;

    // Hall B should now be inherited via area (source=area), not direct.
    const entryB = dept.halls?.find((h) => h.id === hallBId);
    expect(entryB?.source).toBe('area');

    // Hall A (Area A) must no longer appear — dept left Area A.
    const entryA = dept.halls?.find((h) => h.id === hallAId);
    expect(entryA).toBeUndefined();
  });
});

// ---- Area-side cleanup: assigning a formerly cross-area hall to dept's area

describe('Department Halls: Area-assignment removes redundant junction rows', () => {
  it('Setup — move dept back to Area A and directly assign Hall B as cross-area', async () => {
    await fetch(`${BASE_URL}/departments/${deptId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ areaId: areaAId }),
    });

    const res = await fetch(`${BASE_URL}/departments/${deptId}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ hallIds: [hallBId] }),
    });
    expect(res.status).toBe(201);
  });

  it('POST /areas/:areaAId/halls including Hall B removes the redundant junction row', async () => {
    // Area A now claims Hall B as well (moves Hall B from Area B into Area A).
    // Since Hall B becomes inherited by dept (via Area A), the junction row is redundant
    // and must be cleaned up by the service.
    const res = await fetch(`${BASE_URL}/areas/${areaAId}/halls`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ hallIds: [hallAId, hallBId] }),
    });
    expect(res.status).toBe(201);

    const getRes = await fetch(`${BASE_URL}/departments/${deptId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await getRes.json()) as JsonBody;
    const dept = body.data as DepartmentPayload;

    const entryB = dept.halls?.find((h) => h.id === hallBId);
    expect(entryB?.source).toBe('area');

    // No duplicate — Hall B should only appear once.
    const bCount = dept.halls?.filter((h) => h.id === hallBId).length ?? 0;
    expect(bCount).toBe(1);
  });
});
