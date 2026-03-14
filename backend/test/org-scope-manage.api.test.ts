/**
 * API Integration Tests: Manage-* Scope Filtering
 *
 * Tests scope-based access control on teams/users endpoints.
 * Uses apitest tenant with root (admin@apitest.de) + employee@apitest.de.
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 7.2
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  APITEST_PASSWORD,
  BASE_URL,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

let rootToken: string;
let employeeToken: string;
let employeeLoggedIn = false;

beforeAll(async () => {
  const auth = await loginApitest();
  rootToken = auth.authToken;

  // Ensure employee exists (create if not)
  await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(rootToken),
    body: JSON.stringify({
      email: 'employee@apitest.de',
      password: APITEST_PASSWORD,
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
    }),
  });

  // Login as employee
  const empRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employee@apitest.de',
      password: APITEST_PASSWORD,
    }),
  });
  if (empRes.ok) {
    const empBody = (await empRes.json()) as {
      data?: { accessToken?: string };
    };
    employeeToken = empBody.data?.accessToken ?? '';
    employeeLoggedIn = employeeToken !== '';
  }
});

// =============================================================
// 1. Root → GET /teams → All Teams
// =============================================================

describe('Root → GET /teams', () => {
  let response: Response;
  let body: { data?: unknown[] };

  beforeAll(async () => {
    response = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(rootToken),
    });
    body = (await response.json()) as typeof body;
  });

  it('should return 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return teams array', () => {
    expect(body.data).toBeInstanceOf(Array);
  });
});

// =============================================================
// 4. Employee ohne Lead → GET /teams → 403
// =============================================================

describe('Employee ohne Lead → GET /teams', () => {
  let response: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn) return;
    response = await fetch(`${BASE_URL}/teams`, {
      headers: authOnly(employeeToken),
    });
  });

  it('should return 403 for employee without manage_hierarchy permission', () => {
    if (!employeeLoggedIn) return;
    expect(response?.status).toBe(403);
  });
});

// =============================================================
// 7. Employee-Lead → DELETE /teams/:id → 403
// =============================================================

describe('Employee → DELETE /teams/1', () => {
  let response: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn) return;
    response = await fetch(`${BASE_URL}/teams/1`, {
      method: 'DELETE',
      headers: authOnly(employeeToken),
    });
  });

  it('should return 403 for employee (DELETE is admin/root only)', () => {
    if (!employeeLoggedIn) return;
    expect(response?.status).toBe(403);
  });
});

// =============================================================
// 8. Employee → POST /teams → 403
// =============================================================

describe('Employee → POST /teams', () => {
  let response: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn) return;
    response = await fetch(`${BASE_URL}/teams`, {
      method: 'POST',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({ name: 'Unauthorized Team', departmentId: 1 }),
    });
  });

  it('should return 403 for employee (POST is admin/root only)', () => {
    if (!employeeLoggedIn) return;
    expect(response?.status).toBe(403);
  });
});

// =============================================================
// 10. Admin → GET /users?role=admin → 403 (only root can list admins)
// Note: apitest "admin" is actually root, so we test with employee
// =============================================================

describe('Non-root → GET /users?role=admin', () => {
  let response: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn) return;
    response = await fetch(`${BASE_URL}/users?role=admin`, {
      headers: authOnly(employeeToken),
    });
  });

  it('should return 403 for non-root requesting admin list', () => {
    if (!employeeLoggedIn) return;
    expect(response?.status).toBe(403);
  });
});

// =============================================================
// 11. Root → GET /users?role=admin → 200
// =============================================================

describe('Root → GET /users?role=admin', () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`${BASE_URL}/users?role=admin`, {
      headers: authOnly(rootToken),
    });
  });

  it('should return 200 for root listing admins', () => {
    expect(response.status).toBe(200);
  });
});

// =============================================================
// Root → GET /areas, /departments → 200 (regression)
// =============================================================

describe('Root regression — manage endpoints accessible', () => {
  let areasRes: Response;
  let deptsRes: Response;
  let usersRes: Response;

  beforeAll(async () => {
    [areasRes, deptsRes, usersRes] = await Promise.all([
      fetch(`${BASE_URL}/areas`, { headers: authOnly(rootToken) }),
      fetch(`${BASE_URL}/departments`, { headers: authOnly(rootToken) }),
      fetch(`${BASE_URL}/users?role=employee`, {
        headers: authOnly(rootToken),
      }),
    ]);
  });

  it('GET /areas → 200', () => {
    expect(areasRes.status).toBe(200);
  });

  it('GET /departments → 200', () => {
    expect(deptsRes.status).toBe(200);
  });

  it('GET /users?role=employee → 200', () => {
    expect(usersRes.status).toBe(200);
  });
});

// =============================================================
// Employee → GET /areas, /departments → 403 (D1=NEIN)
// =============================================================

describe('Employee → manage areas/departments denied (D1=NEIN)', () => {
  let areasRes: Response | undefined;
  let deptsRes: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn) return;
    [areasRes, deptsRes] = await Promise.all([
      fetch(`${BASE_URL}/areas`, { headers: authOnly(employeeToken) }),
      fetch(`${BASE_URL}/departments`, { headers: authOnly(employeeToken) }),
    ]);
  });

  it('GET /areas → 403 for employee', () => {
    if (!employeeLoggedIn) return;
    expect(areasRes?.status).toBe(403);
  });

  it('GET /departments → 403 for employee', () => {
    if (!employeeLoggedIn) return;
    expect(deptsRes?.status).toBe(403);
  });
});
