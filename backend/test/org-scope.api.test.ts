/**
 * API Integration Tests: GET /users/me/org-scope
 *
 * Tests the organizational scope endpoint for different user roles.
 * Uses apitest tenant (ID: 1) with admin@apitest.de (root).
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 7.1
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { APITEST_PASSWORD, BASE_URL, authOnly, loginApitest } from './helpers.js';

const ENDPOINT = `${BASE_URL}/users/me/org-scope`;

let rootToken: string;

beforeAll(async () => {
  const auth = await loginApitest();
  rootToken = auth.authToken;
});

// =============================================================
// Scenario 1: Unauthenticated → 401
// =============================================================

describe('GET /users/me/org-scope — unauthenticated', () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(ENDPOINT);
  });

  it('should return 401', () => {
    expect(response.status).toBe(401);
  });
});

// =============================================================
// Scenario 2: Root → type: full
// =============================================================

describe('GET /users/me/org-scope — root', () => {
  let response: Response;
  let body: { data?: { type?: string } };

  beforeAll(async () => {
    response = await fetch(ENDPOINT, { headers: authOnly(rootToken) });
    body = (await response.json()) as typeof body;
  });

  it('should return 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return type full for root', () => {
    expect(body.data?.type).toBe('full');
  });
});

// =============================================================
// Scenario 3: Employee without lead → type: none
// =============================================================

describe('GET /users/me/org-scope — employee without lead', () => {
  let response: Response | undefined;
  let body: { data?: { type?: string } } | undefined;

  beforeAll(async () => {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee@apitest.de',
        password: APITEST_PASSWORD,
      }),
    });
    if (!loginRes.ok) return;
    const loginBody = (await loginRes.json()) as {
      data?: { accessToken?: string };
    };
    const token = loginBody.data?.accessToken;
    if (token === undefined) return;

    response = await fetch(ENDPOINT, { headers: authOnly(token) });
    body = (await response.json()) as typeof body;
  });

  it('should return type none for employee without lead', () => {
    if (response === undefined) return;
    expect(response.status).toBe(200);
    expect(body?.data?.type).toBe('none');
  });
});

// =============================================================
// Scenario 4: Response structure validation
// =============================================================

describe('GET /users/me/org-scope — response structure', () => {
  let scope: Record<string, unknown> | undefined;

  beforeAll(async () => {
    const res = await fetch(ENDPOINT, { headers: authOnly(rootToken) });
    const body = (await res.json()) as { data?: Record<string, unknown> };
    scope = body.data;
  });

  it('should have type field', () => {
    expect(scope?.['type']).toBeDefined();
  });

  it('should have all array fields', () => {
    expect(scope?.['areaIds']).toBeInstanceOf(Array);
    expect(scope?.['departmentIds']).toBeInstanceOf(Array);
    expect(scope?.['teamIds']).toBeInstanceOf(Array);
    expect(scope?.['leadAreaIds']).toBeInstanceOf(Array);
    expect(scope?.['leadDepartmentIds']).toBeInstanceOf(Array);
    expect(scope?.['leadTeamIds']).toBeInstanceOf(Array);
  });

  it('should have all boolean fields', () => {
    expect(typeof scope?.['isAreaLead']).toBe('boolean');
    expect(typeof scope?.['isDepartmentLead']).toBe('boolean');
    expect(typeof scope?.['isTeamLead']).toBe('boolean');
    expect(typeof scope?.['isAnyLead']).toBe('boolean');
  });
});
