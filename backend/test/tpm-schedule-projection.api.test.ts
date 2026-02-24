/**
 * TPM Schedule Projection API Integration Tests (Session 37)
 *
 * Covers GET /tpm/plans/schedule-projection query validation,
 * authentication, and response structure.
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authOnly,
  loginApitest,
} from './helpers.js';

const ENDPOINT = `${BASE_URL}/tpm/plans/schedule-projection`;

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 0 -- Unauthenticated ------------------------------------------------

describe('Schedule Projection: Unauthenticated', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${ENDPOINT}?startDate=2026-03-01&endDate=2026-03-07`);
  });

  it('should return 401 without auth token', () => {
    expect(res.status).toBe(401);
  });
});

// ---- seq: 1 -- Valid request ---------------------------------------------------

describe('Schedule Projection: Valid request', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-01&endDate=2026-03-07`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return dateRange in response', () => {
    expect(body.dateRange).toBeDefined();
    expect(body.dateRange.startDate).toBe('2026-03-01');
    expect(body.dateRange.endDate).toBe('2026-03-07');
  });

  it('should return slots array', () => {
    expect(Array.isArray(body.slots)).toBe(true);
  });

  it('should return totalSlots as number', () => {
    expect(typeof body.totalSlots).toBe('number');
  });
});

// ---- seq: 2 -- Missing startDate -----------------------------------------------

describe('Schedule Projection: Missing startDate', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?endDate=2026-03-07`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 3 -- Missing endDate -------------------------------------------------

describe('Schedule Projection: Missing endDate', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-01`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 4 -- Range exceeds 365 days ------------------------------------------

describe('Schedule Projection: Range > 365 days', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-01-01&endDate=2027-01-02`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 5 -- endDate before startDate -----------------------------------------

describe('Schedule Projection: endDate < startDate', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-10&endDate=2026-03-01`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 6 -- excludePlanUuid valid --------------------------------------------

describe('Schedule Projection: excludePlanUuid valid', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Use a random UUID that won't match any plan — endpoint should still succeed
    const fakeUuid = '01961234-5678-7abc-8def-0123456789ab';
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-01&endDate=2026-03-07&excludePlanUuid=${fakeUuid}`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return valid structure with slots array', () => {
    expect(Array.isArray(body.slots)).toBe(true);
    expect(body.dateRange).toBeDefined();
  });
});

// ---- seq: 7 -- Invalid excludePlanUuid ------------------------------------------

describe('Schedule Projection: Invalid excludePlanUuid', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-01&endDate=2026-03-07&excludePlanUuid=not-a-uuid`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 8 -- Invalid date format ----------------------------------------------

describe('Schedule Projection: Invalid date format', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=03-01-2026&endDate=03-07-2026`,
      { headers: authOnly(auth.authToken) },
    );
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 9 -- Single day range -------------------------------------------------

describe('Schedule Projection: Single day range', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${ENDPOINT}?startDate=2026-03-01&endDate=2026-03-01`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return same start and end date', () => {
    expect(body.dateRange.startDate).toBe('2026-03-01');
    expect(body.dateRange.endDate).toBe('2026-03-01');
  });
});
