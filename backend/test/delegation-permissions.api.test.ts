/**
 * API Integration Tests: Delegated Permission Management
 *
 * @see docs/FEAT_DELEGATED_PERMISSION_MANAGEMENT_MASTERPLAN.md Step 3.2
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  APITEST_PASSWORD,
  BASE_URL,
  authHeaders,
  authOnly,
  getDefaultPositionIds,
  loginApitest,
} from './helpers.js';

let rootToken: string;
let rootUuid: string;
let employeeUuid: string;
let employeeToken: string;
let employeeLoggedIn = false;

beforeAll(async () => {
  const auth = await loginApitest();
  rootToken = auth.authToken;

  // Get root's own UUID
  const meRes = await fetch(`${BASE_URL}/users/me`, {
    headers: authOnly(rootToken),
  });
  const meBody = (await meRes.json()) as { data?: { uuid?: string } };
  rootUuid = meBody.data?.uuid ?? '';

  // Create test employee
  const positionIds = await getDefaultPositionIds(rootToken);
  const createRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(rootToken),
    body: JSON.stringify({
      email: `perm-api-test-${Date.now()}@assixx.com`,
      password: APITEST_PASSWORD,
      firstName: 'PermAPI',
      lastName: 'Test',
      role: 'employee',
      positionIds,
    }),
  });
  if (createRes.ok) {
    const createBody = (await createRes.json()) as { data?: { uuid?: string } };
    employeeUuid = createBody.data?.uuid ?? '';
  }

  // Login as employee
  const empRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employee@assixx.com',
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

// 1. Root → GET permissions for employee → 200
describe('Root → GET /user-permissions/:uuid', () => {
  let response: Response;

  beforeAll(async () => {
    if (employeeUuid === '') return;
    response = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(rootToken),
    });
  });

  it('should return 200', () => {
    if (employeeUuid === '') return;
    expect(response.status).toBe(200);
  });
});

// 2. Root → PUT permissions for employee → 200
describe('Root → PUT /user-permissions/:uuid', () => {
  let response: Response;

  beforeAll(async () => {
    if (employeeUuid === '') return;
    response = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      method: 'PUT',
      headers: authHeaders(rootToken),
      body: JSON.stringify({
        permissions: [
          {
            addonCode: 'blackboard',
            moduleCode: 'blackboard-posts',
            canRead: true,
            canWrite: false,
            canDelete: false,
          },
        ],
      }),
    });
  });

  it('should return 200', () => {
    if (employeeUuid === '') return;
    expect(response.status).toBe(200);
  });
});

// 3. Employee without manage-permissions → GET → 403
describe('Employee → GET /user-permissions/:uuid → 403', () => {
  let response: Response | undefined;

  beforeAll(async () => {
    if (!employeeLoggedIn || employeeUuid === '') return;
    response = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
      headers: authOnly(employeeToken),
    });
  });

  it('should return 403', () => {
    if (!employeeLoggedIn) return;
    expect(response?.status).toBe(403);
  });
});

// 4. Root self-edit → 200 (Root is exception)
describe('Root → GET own permissions → 200', () => {
  let response: Response;

  beforeAll(async () => {
    if (rootUuid === '') return;
    response = await fetch(`${BASE_URL}/user-permissions/${rootUuid}`, {
      headers: authOnly(rootToken),
    });
  });

  it('should return 200 (root can self-access)', () => {
    if (rootUuid === '') return;
    expect(response.status).toBe(200);
  });
});

// 5. Unauthenticated → 401
describe('Unauthenticated → GET /user-permissions/:uuid → 401', () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`${BASE_URL}/user-permissions/any-uuid`);
  });

  it('should return 401', () => {
    expect(response.status).toBe(401);
  });
});

// 6. Root → GET nonexistent → 404
describe('Root → GET /user-permissions/nonexistent → 404', () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`${BASE_URL}/user-permissions/00000000-0000-0000-0000-000000000000`, {
      headers: authOnly(rootToken),
    });
  });

  it('should return 404', () => {
    expect(response.status).toBe(404);
  });
});
