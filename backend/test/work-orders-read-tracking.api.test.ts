/**
 * Work Order Read-Tracking API Integration Tests
 *
 * Tests the "Neu" badge feature: per-user read tracking for work orders.
 * Covers: list (isRead field), mark-as-read endpoint, idempotency.
 *
 * Runs against REAL backend (Docker must be running).
 * Prerequisite: work_orders feature enabled for apitest tenant.
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

// Module-level state shared across sequential describe blocks
let workOrderUuid: string;

beforeAll(async () => {
  auth = await loginApitest();
});

// ─── Create Work Order (seq: 1) ─────────────────────────────────────────────

describe('Create Work Order for Read-Tracking', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Read-Track Test ${Date.now()}`,
        description: 'Created for read-tracking integration test',
        priority: 'medium',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.uuid) {
      workOrderUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return work order with uuid', () => {
    expect(body.data).toHaveProperty('uuid');
    expect(typeof body.data.uuid).toBe('string');
  });
});

// ─── List Work Orders — isRead=false before read (seq: 2) ───────────────────

describe('List Work Orders (before mark-as-read)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return paginated items', () => {
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data).toHaveProperty('total');
  });

  it('should include isRead field on list items', () => {
    const items = body.data.items as JsonBody[];
    expect(items.length).toBeGreaterThan(0);

    const testItem = items.find((i: JsonBody) => i.uuid === workOrderUuid);
    expect(testItem).toBeDefined();
    expect(testItem).toHaveProperty('isRead');
    expect(typeof testItem!.isRead).toBe('boolean');
  });

  it('should have isRead=false for newly created work order', () => {
    const items = body.data.items as JsonBody[];
    const testItem = items.find((i: JsonBody) => i.uuid === workOrderUuid);
    expect(testItem!.isRead).toBe(false);
  });
});

// ─── Mark as Read (seq: 3) ──────────────────────────────────────────────────

describe('Mark Work Order as Read', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/read`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return success in data', () => {
    expect(body.data).toHaveProperty('success');
    expect(body.data.success).toBe(true);
  });
});

// ─── List Work Orders — isRead=true after read (seq: 4) ─────────────────────

describe('List Work Orders (after mark-as-read)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should have isRead=true for the marked work order', () => {
    const items = body.data.items as JsonBody[];
    const testItem = items.find((i: JsonBody) => i.uuid === workOrderUuid);
    expect(testItem).toBeDefined();
    expect(testItem!.isRead).toBe(true);
  });
});

// ─── Mark as Read — Idempotent (seq: 5) ─────────────────────────────────────

describe('Mark Work Order as Read (idempotent)', () => {
  it('should return 200 OK on second call', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/read`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.success).toBe(true);
  });
});

// ─── Mark as Read — Invalid UUID (seq: 6) ───────────────────────────────────

describe('Mark as Read — non-existent UUID', () => {
  it('should return 404 Not Found', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/work-orders/${fakeUuid}/read`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
  });
});

// ─── Cleanup: Delete Work Order (seq: 7) ────────────────────────────────────

describe('Cleanup: Delete Work Order', () => {
  it('should return 204 No Content', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(204);
  });
});
