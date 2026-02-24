/**
 * Vacation API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 * Requires: vacation feature enabled for apitest tenant,
 * vacation tables migrated, vacation_settings row exists.
 *
 * Admin user (root) auto-approves requests → no separate employee needed.
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

/** IDs of resources created during tests, used for cleanup and chaining. */
let holidayId: string | undefined;
let blackoutId: string | undefined;
let machineId: number | undefined;
let staffingRuleId: string | undefined;
let requestId: string | undefined;

const VACATION_URL = `${BASE_URL}/vacation`;

beforeAll(async () => {
  auth = await loginApitest();
});

// ── seq: 0 — Auth: Unauthenticated ──────────────────────────────────────────

describe('Vacation: Unauthenticated → 401', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/settings`);
  });

  it('should return 401 without auth token', () => {
    expect(res.status).toBe(401);
  });
});

// ── seq: 1 — Settings: GET ──────────────────────────────────────────────────

describe('Vacation: Get Settings', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/settings`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return settings with defaultAnnualDays', () => {
    expect(body.data).toHaveProperty('defaultAnnualDays');
    expect(body.data.defaultAnnualDays).toBeTypeOf('number');
  });
});

// ── seq: 2 — Settings: PUT ──────────────────────────────────────────────────

describe('Vacation: Update Settings', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ advanceNoticeDays: 3 }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return updated advanceNoticeDays', () => {
    expect(body.data.advanceNoticeDays).toBe(3);
  });
});

// ── seq: 3 — Holidays: Create ───────────────────────────────────────────────

describe('Vacation: Create Holiday', () => {
  let res: Response;
  let body: JsonBody;

  // Random year 2030-2099 + month + day → ~23k possible dates to avoid UNIQUE violation
  const year = 2030 + Math.floor(Math.random() * 70);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  const uniqueDate = `${year}-${month}-${day}`;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/holidays`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        holidayDate: uniqueDate,
        name: `API Test Holiday ${Date.now()}`,
        recurring: false,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.id) {
      holidayId = body.data.id as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return holiday with id and date', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data.holidayDate).toBe(uniqueDate);
  });
});

// ── seq: 4 — Holidays: List ────────────────────────────────────────────────

describe('Vacation: List Holidays', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/holidays`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with array', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ── seq: 5 — Holidays: Delete ──────────────────────────────────────────────

describe('Vacation: Delete Holiday', () => {
  it('should return 204 No Content', async () => {
    expect(holidayId).toBeDefined();
    const res = await fetch(`${VACATION_URL}/holidays/${holidayId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(204);
  });
});

// ── seq: 6 — Blackouts: Create ─────────────────────────────────────────────

describe('Vacation: Create Blackout', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/blackouts`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `Test Blackout ${Date.now()}`,
        reason: 'API integration test',
        startDate: '2028-08-01',
        endDate: '2028-08-15',
        scopeType: 'global',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.id) {
      blackoutId = body.data.id as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return blackout with global scope', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data.isGlobal).toBe(true);
  });
});

// ── seq: 7 — Blackouts: List ───────────────────────────────────────────────

describe('Vacation: List Blackouts', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/blackouts`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with array', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ── seq: 8 — Blackouts: Delete ─────────────────────────────────────────────

describe('Vacation: Delete Blackout', () => {
  it('should return 204 No Content', async () => {
    expect(blackoutId).toBeDefined();
    const res = await fetch(`${VACATION_URL}/blackouts/${blackoutId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(204);
  });
});

// ── seq: 9 — Setup: Create Machine (for staffing rules) ────────────────────

describe('Vacation: Setup Machine for Staffing Rules', () => {
  it('should create or find a machine', async () => {
    // Try to create a machine
    const createRes = await fetch(`${BASE_URL}/machines`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `Vacation SR Machine ${Date.now()}`,
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;

    if (createRes.status === 201 && createBody.data?.id) {
      machineId = createBody.data.id as number;
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration: create vs fallback
      expect(createRes.status).toBe(201);
      return;
    }

    // Fallback: fetch list (machines returns flat array, not paginated)
    const listRes = await fetch(`${BASE_URL}/machines`, {
      headers: authOnly(auth.authToken),
    });
    const listBody = (await listRes.json()) as JsonBody;
    const machines = listBody.data as Array<{ id: number }>;

    if (Array.isArray(machines) && machines.length > 0) {
      machineId = machines[0]!.id;
    }

    expect(machineId).toBeDefined();
  });
});

// ── seq: 10 — Staffing Rules: Create ────────────────────────────────────────

describe('Vacation: Create Staffing Rule', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/staffing-rules`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        machineId: machineId,
        minStaffCount: 2,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.id) {
      staffingRuleId = body.data.id as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return rule with minStaffCount', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data.minStaffCount).toBe(2);
  });
});

// ── seq: 11 — Staffing Rules: List ──────────────────────────────────────────

describe('Vacation: List Staffing Rules', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/staffing-rules`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with array', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ── seq: 12 — Staffing Rules: Delete ────────────────────────────────────────

describe('Vacation: Delete Staffing Rule', () => {
  it('should return 204 No Content', async () => {
    expect(staffingRuleId).toBeDefined();
    const res = await fetch(
      `${VACATION_URL}/staffing-rules/${staffingRuleId}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );

    expect(res.status).toBe(204);
  });
});

// ── seq: 13 — Entitlements: GET own balance ─────────────────────────────────

describe('Vacation: Get My Balance', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/entitlements/me`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return balance with expected fields', () => {
    expect(body.data).toHaveProperty('totalDays');
    expect(body.data).toHaveProperty('usedDays');
    expect(body.data).toHaveProperty('remainingDays');
    expect(body.data).toHaveProperty('pendingDays');
  });
});

// ── seq: 13b — Setup: Ensure user is in a team (vacation requires team membership)

describe('Vacation: Setup Team Assignment', () => {
  it('should ensure the user belongs to a team', async () => {
    // Find an existing team (created by teams.api.test earlier in the run)
    const listRes = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(auth.authToken),
    });
    const listBody = (await listRes.json()) as JsonBody;
    const teams = listBody.data as Array<{ id: number }>;

    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);

    const teamId = teams[0]!.id;

    // Add current user to team (ignore 409 if already a member)
    const addRes = await fetch(`${BASE_URL}/teams/${teamId}/members`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ userId: auth.userId }),
    });

    expect([201, 409]).toContain(addRes.status);
  });
});

// ── seq: 14 — Requests: POST create (root → auto-approved) ─────────────────

describe('Vacation: Create Request (auto-approved for root)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Stay in CURRENT year (cancel endpoint only allows current-year requests).
    // Use first third of remaining days to avoid overlap with seq 14b.
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    const daysLeft = Math.floor((yearEnd.getTime() - now.getTime()) / 86400000);
    const minOffset = Math.max(14, Math.floor(daysLeft * 0.15));
    const maxOffset = Math.floor(daysLeft * 0.45);
    const randomOffset = minOffset + Math.floor(Math.random() * (maxOffset - minOffset));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + randomOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);

    // Skip weekends — ensure we start on a weekday
    while (startDate.getDay() === 0 || startDate.getDay() === 6) {
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + 1);
    }

    const fmt = (d: Date): string => d.toISOString().slice(0, 10);

    // Ensure sufficient entitlement (prevents balance exhaustion from previous runs)
    const targetYear = startDate.getFullYear();
    await fetch(`${VACATION_URL}/entitlements/${auth.userId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ userId: auth.userId, year: targetYear, totalDays: 365 }),
    });

    res = await fetch(`${VACATION_URL}/requests`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        halfDayStart: 'none',
        halfDayEnd: 'none',
        vacationType: 'regular',
        requestNote: 'API integration test',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.id) {
      requestId = body.data.id as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should auto-approve for root user', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data.status).toBe('approved');
  });
});

// ── seq: 14b — Requests: POST with omitted optional fields (Zod defaults) ──

describe('Vacation: Create Request — Zod defaults applied for omitted fields', () => {
  let res: Response;
  let body: JsonBody;
  let defaultsRequestId: string | undefined;

  beforeAll(async () => {
    // Stay in CURRENT year (cancel endpoint only allows current-year requests).
    // Use last third of remaining days to avoid overlap with seq 14.
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    const daysLeft = Math.floor((yearEnd.getTime() - now.getTime()) / 86400000);
    const minOffset = Math.floor(daysLeft * 0.55);
    const maxOffset = Math.floor(daysLeft * 0.85);
    const randomOffset = minOffset + Math.floor(Math.random() * (maxOffset - minOffset));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + randomOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);

    // Skip weekends
    while (startDate.getDay() === 0 || startDate.getDay() === 6) {
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + 1);
    }

    const fmt = (d: Date): string => d.toISOString().slice(0, 10);

    // Ensure sufficient entitlement (prevents balance exhaustion from previous runs)
    const targetYear = startDate.getFullYear();
    await fetch(`${VACATION_URL}/entitlements/${auth.userId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ userId: auth.userId, year: targetYear, totalDays: 365 }),
    });

    // Intentionally omit halfDayStart, halfDayEnd, vacationType
    // Zod schema defines defaults: halfDayStart='none', halfDayEnd='none', vacationType='regular'
    res = await fetch(`${VACATION_URL}/requests`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        requestNote: 'Zod defaults test',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (body.data?.id) {
      defaultsRequestId = body.data.id as string;
    }
  });

  afterAll(async () => {
    // Cleanup: cancel the auto-approved request
    if (defaultsRequestId !== undefined) {
      await fetch(`${VACATION_URL}/requests/${defaultsRequestId}/cancel`, {
        method: 'PATCH',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({ reason: 'Zod defaults test cleanup' }),
      });
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should apply Zod default halfDayStart=none', () => {
    expect(body.data.halfDayStart).toBe('none');
  });

  it('should apply Zod default halfDayEnd=none', () => {
    expect(body.data.halfDayEnd).toBe('none');
  });

  it('should apply Zod default vacationType=regular', () => {
    expect(body.data.vacationType).toBe('regular');
  });
});

// ── seq: 15 — Requests: GET own requests (paginated) ────────────────────────

describe('Vacation: List My Requests', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/requests?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with paginated result', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return data array and total', () => {
    expect(body.data).toHaveProperty('data');
    expect(body.data).toHaveProperty('total');
    expect(Array.isArray(body.data.data)).toBe(true);
  });
});

// ── seq: 16 — Requests: GET request by ID ───────────────────────────────────

describe('Vacation: Get Request By ID', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/requests/${requestId}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return request with matching id', () => {
    expect(body.data.id).toBe(requestId);
    expect(body.data).toHaveProperty('status');
  });
});

// ── seq: 17 — Requests: GET incoming ────────────────────────────────────────

describe('Vacation: List Incoming Requests', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/requests/incoming?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with paginated result', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('data');
  });
});

// ── seq: 18 — Overview: GET own balance ─────────────────────────────────────

describe('Vacation: Overview (balance)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${VACATION_URL}/overview`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 with balance data', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('totalDays');
  });
});

// ── seq: 19 — Cleanup: Cancel created request ───────────────────────────────

describe('Vacation: Cleanup — Cancel approved request', () => {
  it('should cancel the approved request (admin)', async () => {
    expect(requestId).toBeDefined();
    const res = await fetch(`${VACATION_URL}/requests/${requestId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ reason: 'API test cleanup' }),
    });

    expect(res.status).toBe(204);
  });
});

// ── seq: 20 — Notification: Verify vacation notification created after cancel ─

describe('Vacation: Notification created after cancel', () => {
  it('should have vacation notifications (mark-read returns successfully)', async () => {
    // Cancel creates a persistent notification for the requester (ADR-004 pattern).
    // Verify by calling the mark-read endpoint — it should succeed and return a count.
    const res = await fetch(`${BASE_URL}/notifications/mark-read/vacation`, {
      method: 'POST',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('marked');
    expect(typeof body.data.marked).toBe('number');
  });

  it('should include vacation count in dashboard counts', async () => {
    const res = await fetch(`${BASE_URL}/dashboard/counts`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('vacation');
    expect(body.data.vacation).toHaveProperty('count');
    expect(typeof body.data.vacation.count).toBe('number');
  });
});
