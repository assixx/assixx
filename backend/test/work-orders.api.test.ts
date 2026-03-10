/**
 * Work Orders API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Tests full CRUD lifecycle: Create → List → Get → Update → Status → Comment → Stats → Delete
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

/** UUID of the work order created during tests — reused across describe blocks */
let workOrderUuid: string;

beforeAll(async () => {
  auth = await loginApitest();
});

// ============================================================================
// seq: 1 -- Create Work Order
// ============================================================================

describe('Work Orders: Create', () => {
  it('should return 201 Created with valid payload', async () => {
    const res = await fetch(`${BASE_URL}/work-orders`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API-Test Auftrag ${Date.now()}`,
        description: 'Automatischer Test-Arbeitsauftrag',
        priority: 'high',
        sourceType: 'manual',
        dueDate: '2099-12-31',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.uuid).toBeDefined();
    expect(body.data.title).toContain('API-Test Auftrag');
    expect(body.data.status).toBe('open');
    expect(body.data.priority).toBe('high');
    expect(body.data.sourceType).toBe('manual');
    expect(body.data.createdByName).toBeDefined();

    workOrderUuid = body.data.uuid;
  });

  it('should return 400 for missing title', async () => {
    const res = await fetch(`${BASE_URL}/work-orders`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        description: 'No title provided',
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ============================================================================
// seq: 2 -- List All Work Orders (Admin)
// ============================================================================

describe('Work Orders: List All (Admin)', () => {
  it('should return 200 with paginated structure', async () => {
    const res = await fetch(`${BASE_URL}/work-orders`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBeDefined();
  });

  it('should support status filter', async () => {
    const res = await fetch(`${BASE_URL}/work-orders?status=open`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    for (const item of body.data.items) {
      expect(item.status).toBe('open');
    }
  });

  it('should support pagination', async () => {
    const res = await fetch(`${BASE_URL}/work-orders?page=1&limit=1`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.items.length).toBeLessThanOrEqual(1);
    expect(body.data.pageSize).toBe(1);
  });
});

// ============================================================================
// seq: 3 -- Get Single Work Order
// ============================================================================

describe('Work Orders: Get By UUID', () => {
  it('should return 200 with full detail', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.uuid).toBe(workOrderUuid);
    expect(body.data.assignees).toBeDefined();
    expect(Array.isArray(body.data.assignees)).toBe(true);
    expect(typeof body.data.commentCount).toBe('number');
    expect(typeof body.data.photoCount).toBe('number');
  });

  it('should return 404 for unknown UUID', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/00000000-0000-0000-0000-000000000000`,
      { headers: authOnly(auth.authToken) },
    );

    expect(res.status).toBe(404);
  });
});

// ============================================================================
// seq: 4 -- Update Work Order
// ============================================================================

describe('Work Orders: Update (PATCH)', () => {
  it('should return 200 with updated fields', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Aktualisierter Titel',
        priority: 'low',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.title).toBe('Aktualisierter Titel');
    expect(body.data.priority).toBe('low');
  });
});

// ============================================================================
// seq: 4.5 -- Photo Upload (before status transitions lock it)
// ============================================================================

let photoWorkOrderUuid: string;
let uploadedPhotoUuid: string;

describe('Work Orders: Photo Test Setup', () => {
  it('should create a separate work order for photo tests (201)', async () => {
    const res = await fetch(`${BASE_URL}/work-orders`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Photo-Test WO ${Date.now()}`,
        sourceType: 'manual',
        dueDate: '2099-12-31',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.uuid).toBeDefined();
    photoWorkOrderUuid = body.data.uuid;
  });
});

describe('Work Orders: Upload Image (201)', () => {
  let res: Response;
  beforeAll(async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    formData.append('file', blob, 'test-photo.jpg');
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
  });

  it('should return photo with uuid and mimeType', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.uuid).toBeDefined();
    expect(body.data.mimeType).toBe('image/jpeg');
    uploadedPhotoUuid = body.data.uuid;
  });
});

describe('Work Orders: Upload PDF (201)', () => {
  let res: Response;
  beforeAll(async () => {
    const formData = new FormData();
    const blob = new Blob(['%PDF-1.4 fake content'], {
      type: 'application/pdf',
    });
    formData.append('file', blob, 'test-dokument.pdf');
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
  });

  it('should return 201', () => {
    expect(res.status).toBe(201);
  });

  it('should return photo with pdf mimeType', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.mimeType).toBe('application/pdf');
    expect(body.data.fileName).toBe('test-dokument.pdf');
  });
});

describe('Work Orders: Reject Invalid MIME (400)', () => {
  let res: Response;
  beforeAll(async () => {
    const formData = new FormData();
    const blob = new Blob(['<script>alert(1)</script>'], {
      type: 'text/html',
    });
    formData.append('file', blob, 'hack.html');
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
  });

  it('should return 400 for text/html', () => {
    expect(res.status).toBe(400);
  });
});

describe('Work Orders: List Photos', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should contain uploaded image + PDF', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Work Orders: Serve Photo File', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos/${uploadedPhotoUuid}/file`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 200 with image Content-Type', () => {
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
  });
});

describe('Work Orders: Delete Photo (204)', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos/${uploadedPhotoUuid}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );
  });

  it('should return 204', () => {
    expect(res.status).toBe(204);
  });
});

describe('Work Orders: Photo Test Cleanup', () => {
  it('should archive the photo test work order (204)', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${photoWorkOrderUuid}/archive`,
      {
        method: 'PATCH',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(204);
  });
});

// ============================================================================
// seq: 5 -- Status Transition
// ============================================================================

describe('Work Orders: Status Transition', () => {
  it('should allow open → in_progress', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/status`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(200);
  });

  it('should allow in_progress → completed', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/status`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(200);
  });

  it('should reject invalid transition (completed → open)', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/status`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'open' }),
    });

    expect(res.status).toBe(400);
  });

  it('should allow completed → verified', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}/status`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ status: 'verified' }),
    });

    expect(res.status).toBe(200);
  });
});

// ============================================================================
// seq: 6 -- Comments
// ============================================================================

/** Comment ID for reply testing — set after creating top-level comment */
let topLevelCommentId: number;

describe('Work Orders: Comments', () => {
  it('should add a comment (201) with threading fields', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${workOrderUuid}/comments`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({ content: 'Test-Kommentar vom API-Test' }),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.content).toBe('Test-Kommentar vom API-Test');
    expect(body.data.isStatusChange).toBe(false);
    expect(body.data.id).toBeDefined();
    expect(typeof body.data.firstName).toBe('string');
    expect(typeof body.data.lastName).toBe('string');
    expect(body.data.parentId).toBeNull();
    expect(body.data.replyCount).toBe(0);

    topLevelCommentId = body.data.id;
  });

  it('should add a reply to a comment (201)', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${workOrderUuid}/comments`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({
          content: 'Antwort auf Kommentar',
          parentId: topLevelCommentId,
        }),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.content).toBe('Antwort auf Kommentar');
    expect(body.data.parentId).toBe(topLevelCommentId);
  });

  it('should list top-level comments with pagination', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${workOrderUuid}/comments?page=1&limit=20`,
      { headers: authOnly(auth.authToken) },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.items).toBeDefined();
    expect(body.data.total).toBeGreaterThanOrEqual(1);

    // Top-level comments should not include replies
    for (const item of body.data.items) {
      expect(item.parentId).toBeNull();
      expect(typeof item.replyCount).toBe('number');
    }
  });

  it('should list replies for a comment', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${workOrderUuid}/comments/${topLevelCommentId}/replies`,
      { headers: authOnly(auth.authToken) },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].parentId).toBe(topLevelCommentId);
    expect(body.data[0].content).toBe('Antwort auf Kommentar');
  });
});

// ============================================================================
// seq: 7 -- Stats
// ============================================================================

describe('Work Orders: Stats', () => {
  it('should return stats with correct structure', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.open).toBe('number');
    expect(typeof body.data.inProgress).toBe('number');
    expect(typeof body.data.completed).toBe('number');
    expect(typeof body.data.verified).toBe('number');
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.overdue).toBe('number');
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// seq: 8 -- Eligible Users
// ============================================================================

describe('Work Orders: Eligible Users', () => {
  it('should return eligible users list', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/eligible-users`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================================
// seq: 9 -- My Work Orders (Employee View)
// ============================================================================

describe('Work Orders: My Work Orders', () => {
  it('should return 200 with paginated structure', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/my`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.total).toBe('number');
  });
});

// ============================================================================
// seq: 10 -- Calendar Endpoint
// ============================================================================

describe('Work Orders: Calendar', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/work-orders/calendar?startDate=2000-01-01&endDate=2099-12-31`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return an array in data', () => {
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should reject missing query params (400)', async () => {
    const badRes = await fetch(`${BASE_URL}/work-orders/calendar`, {
      headers: authOnly(auth.authToken),
    });
    expect(badRes.status).toBe(400);
  });

  it('should reject invalid date format (400)', async () => {
    const badRes = await fetch(
      `${BASE_URL}/work-orders/calendar?startDate=invalid&endDate=2026-03-31`,
      { headers: authOnly(auth.authToken) },
    );
    expect(badRes.status).toBe(400);
  });
});

// ============================================================================
// seq: 11 -- Archive Work Order (last — cleans up test data)
// ============================================================================

describe('Work Orders: Archive', () => {
  it('should archive the work order (204)', async () => {
    const res = await fetch(
      `${BASE_URL}/work-orders/${workOrderUuid}/archive`,
      {
        method: 'PATCH',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(204);
  });

  it('should still be accessible after archiving (isActive=3)', async () => {
    const res = await fetch(`${BASE_URL}/work-orders/${workOrderUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as { data: { isActive: number } };

    expect(res.status).toBe(200);
    expect(body.data.isActive).toBe(3);
  });
});
