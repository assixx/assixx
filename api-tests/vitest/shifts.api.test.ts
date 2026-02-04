/**
 * Shifts API Integration Tests
 *
 * Migrated from Bruno CLI: api-tests/shifts/*.bru
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */

import { BASE_URL, authHeaders, authOnly, loginBrunotest, type AuthState, type JsonBody } from './helpers.js';

let auth: AuthState;

/** Team ID created/found during setup */
let shiftsTeamId: number;

/** First shift ID from list, used by get-by-id */
let shiftId: number | undefined;

beforeAll(async () => {
  auth = await loginBrunotest();
});

// ---- seq: 1 -- Setup Shifts Test Team ----------------------------------------

describe('Shifts: Setup Test Team', () => {
  it('should create team or already exist', async () => {
    const res = await fetch(`${BASE_URL}/teams`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Shifts Rotation Test Team',
        description: 'Team for shifts rotation testing',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // 201 = created, 409 = already exists -- both are acceptable
    expect([201, 409]).toContain(res.status);

     
    if (res.status === 201 && body.data?.id) {
      shiftsTeamId = body.data.id as number;
    }
  });

  it('should resolve team ID if team already existed', async () => {
    // If we already got the ID from creation, skip lookup
    if (shiftsTeamId) return;

    // Team existed (409) -- fetch teams list to find the ID
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);

    const team = (body.data as Array<{ id: number; name: string }>).find(
      (t) => t.name === 'Shifts Rotation Test Team',
    );

    expect(team).toBeDefined();
    shiftsTeamId = team!.id;
  });
});

// ---- seq: 1 -- List Shifts ---------------------------------------------------

describe('Shifts: List Shifts', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/shifts?page=1&limit=20`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return shifts array', async () => {
    const res = await fetch(`${BASE_URL}/shifts?page=1&limit=20`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Store first shift ID for subsequent tests
    if (body.data.length > 0) {
      shiftId = body.data[0].id as number;
    }
  });
});

// ---- seq: 2 -- Get Shift by ID ----------------------------------------------

describe('Shifts: Get Shift by ID', () => {
  it('should return 200 OK or 404 Not Found', async () => {
    const id = shiftId ?? 1;
    const res = await fetch(`${BASE_URL}/shifts/${id}`, {
      headers: authOnly(auth.authToken),
    });

    expect([200, 404]).toContain(res.status);
  });

  it('should return shift object or not found error', async () => {
    const id = shiftId ?? 1;
    const res = await fetch(`${BASE_URL}/shifts/${id}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    if (res.status === 200) {
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: response differs by status
      expect(body.data).toHaveProperty('id');
    } else {
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: response differs by status
      expect(body.success).toBe(false);
    }
  });
});

// ---- seq: 3 -- Generate Rotation From Config ---------------------------------

describe('Shifts: Generate Rotation From Config', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/shifts/rotation/generate-from-config`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        config: {
          shiftBlockLength: 5,
          freeDays: 2,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        assignments: [
          {
            userId: auth.userId,
            userName: 'Bruno Test User',
            startGroup: 'F',
          },
        ],
        startDate: '2026-02-01',
        endDate: '2026-02-14',
        teamId: shiftsTeamId,
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return shiftsCreated count', () => {
    expect(body.data.shiftsCreated).toBeTypeOf('number');
  });
});

// ---- seq: 4 -- Delete Shifts by Week (Cleanup) ------------------------------

describe('Shifts: Delete Shifts by Week (Cleanup)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/shifts/week?teamId=${shiftsTeamId}&startDate=2025-01-20&endDate=2025-01-31`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return shiftsDeleted count', () => {
    expect(body.data).toHaveProperty('shiftsDeleted');
    expect(body.data.shiftsDeleted).toBeGreaterThanOrEqual(0);
  });
});

// ---- seq: 5 -- Delete Rotation History (Cleanup) -----------------------------

describe('Shifts: Delete Rotation History (Cleanup)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/shifts/rotation/history?teamId=${shiftsTeamId}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return data with deletedCounts', () => {
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('deletedCounts');
  });
});
