/**
 * TPM Plan Revisions API Integration Tests
 *
 * Covers revision creation on plan create/update, revision listing,
 * single revision retrieval, and edge cases (no changes, changeReason).
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  createAssets,
  deleteAssets,
  loginApitest,
} from './helpers.js';

let auth: AuthState;
let assetUuids: string[] = [];
let assetUuid: string;
let planUuid: string;

beforeAll(async () => {
  auth = await loginApitest();
  assetUuids = await createAssets(auth.authToken, 1);
  assetUuid = assetUuids[0]!;
});

// ---- seq: 0 -- Create Plan → v1 revision -----------------------------------

describe('TPM Revisions: Create Plan → v1', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        assetUuid,
        name: `Revision Test Plan ${Date.now()}`,
        baseWeekday: 1,
        baseRepeatEvery: 1,
        baseTime: '08:00',
        bufferHours: 4,
        notes: 'Initial plan for revision testing',
      }),
    });
    body = (await res.json()) as JsonBody;
    if (res.status === 201) {
      planUuid = body.data.uuid as string;
    }
  });

  it('should create plan with revisionNumber = 1', () => {
    expect(res.status).toBe(201);
    expect(body.data.revisionNumber).toBe(1);
  });

  it('should have v1 revision in history', async () => {
    const revRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const revBody = (await revRes.json()) as JsonBody;

    expect(revRes.status).toBe(200);
    expect(revBody.data.currentVersion).toBe(1);
    expect(revBody.data.total).toBe(1);
    expect(revBody.data.revisions).toHaveLength(1);
    expect(revBody.data.revisions[0].revisionNumber).toBe(1);
    expect(revBody.data.revisions[0].changedFields).toEqual([]);
    expect(revBody.data.revisions[0].changeReason).toBe('Initial version');
  });
});

// ---- seq: 1 -- Update Plan → v2 revision -----------------------------------

describe('TPM Revisions: Update Plan → v2', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        baseTime: '14:00',
        changeReason: 'Schichtwechsel erfordert neuen Zeitslot',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return updated plan with revisionNumber = 2', () => {
    expect(res.status).toBe(200);
    expect(body.data.revisionNumber).toBe(2);
    expect(body.data.baseTime).toBe('14:00:00');
  });

  it('should have v2 revision with correct diff and changeReason', async () => {
    const revRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const revBody = (await revRes.json()) as JsonBody;

    expect(revBody.data.currentVersion).toBe(2);
    expect(revBody.data.total).toBe(2);

    // Newest first
    const v2 = revBody.data.revisions[0];
    expect(v2.revisionNumber).toBe(2);
    expect(v2.changedFields).toEqual(['base_time']);
    expect(v2.changeReason).toBe('Schichtwechsel erfordert neuen Zeitslot');
    expect(v2.baseTime).toBe('14:00:00');

    const v1 = revBody.data.revisions[1];
    expect(v1.revisionNumber).toBe(1);
    expect(v1.baseTime).toBe('08:00:00');
  });
});

// ---- seq: 2 -- Update with no actual changes → no new revision ---------------

describe('TPM Revisions: No-change update', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Send same baseTime that's already set
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ baseTime: '14:00' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 but NOT increment revision', () => {
    expect(res.status).toBe(200);
    expect(body.data.revisionNumber).toBe(2); // still 2, not 3
  });

  it('should still have only 2 revisions', async () => {
    const revRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const revBody = (await revRes.json()) as JsonBody;

    expect(revBody.data.total).toBe(2);
  });
});

// ---- seq: 3 -- Get single revision by UUID -----------------------------------

describe('TPM Revisions: Get single revision', () => {
  let revisionUuid: string;

  beforeAll(async () => {
    const revRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions?page=1&limit=1`, {
      headers: authOnly(auth.authToken),
    });
    const revBody = (await revRes.json()) as JsonBody;
    revisionUuid = revBody.data.revisions[0].uuid as string;
  });

  it('should return single revision with all fields', async () => {
    const res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions/${revisionUuid}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.uuid).toBe(revisionUuid);
    expect(body.data.changedByName).toBeTruthy();
    expect(typeof body.data.bufferHours).toBe('number');
  });

  it('should return 404 for invalid revision UUID', async () => {
    const res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions/nonexistent-uuid`, {
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(404);
  });
});

// ---- seq: 4 -- Multiple updates → v3 correct order --------------------------

describe('TPM Revisions: Multiple updates → v3', () => {
  beforeAll(async () => {
    await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ name: 'Updated Plan v3' }),
    });
  });

  it('should have 3 revisions in correct order', async () => {
    const revRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    const revBody = (await revRes.json()) as JsonBody;

    expect(revBody.data.currentVersion).toBe(3);
    expect(revBody.data.total).toBe(3);
    expect(revBody.data.revisions[0].revisionNumber).toBe(3);
    expect(revBody.data.revisions[1].revisionNumber).toBe(2);
    expect(revBody.data.revisions[2].revisionNumber).toBe(1);
  });
});

// ---- seq: 5 -- Unauthenticated → 401 ----------------------------------------

describe('TPM Revisions: Unauthenticated', () => {
  it('should return 401 without auth token', async () => {
    const res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/revisions`);
    expect(res.status).toBe(401);
  });
});

// ---- seq: 6 -- Cleanup -------------------------------------------------------

afterAll(async () => {
  // Delete plan (soft-delete cascades revisions)
  if (planUuid) {
    await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
  // Delete assets
  await deleteAssets(auth.authToken, assetUuids);
});
