/**
 * TPM Plans + Cards API Integration Tests (Session 19)
 *
 * Covers Plan CRUD, Card CRUD, Time Estimates, Board Data, and Duplicate Check.
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

// Shared state across sequential describe blocks
let assetUuids: string[] = [];
let assetUuid: string;
let planUuid: string;
let cardUuid: string;
let timeEstimateUuid: string;
let approvalConfigUuid: string | null = null;

beforeAll(async () => {
  auth = await loginApitest();

  // Create own asset (self-sufficient — no dependency on other suites)
  assetUuids = await createAssets(auth.authToken, 1);
  assetUuid = assetUuids[0]!;

  // Create TPM approval master config (D6: needed for approval requests to be created)
  const configRes = await fetch(`${BASE_URL}/approvals/configs`, {
    method: 'PUT',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      addonCode: 'tpm',
      approverType: 'user',
      approverUserId: auth.userId,
    }),
  });
  if (configRes.status === 200 || configRes.status === 201) {
    const configBody = (await configRes.json()) as JsonBody;
    approvalConfigUuid = (configBody.data?.uuid as string) ?? null;
  }
});

// ---- seq: 0 -- Unauthenticated ------------------------------------------------

describe('TPM: Unauthenticated', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans`);
  });

  it('should return 401 without auth token', () => {
    expect(res.status).toBe(401);
  });
});

// ---- seq: 1 -- Create Plan ----------------------------------------------------

describe('TPM: Create Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        assetUuid,
        name: `TPM Test Plan ${Date.now()}`,
        baseWeekday: 1,
        baseRepeatEvery: 1,
        baseTime: '08:00',
        notes: 'Created via API test',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      planUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return plan with uuid', () => {
    expect(body.data.uuid).toBeDefined();
    expect(typeof body.data.uuid).toBe('string');
  });

  it('should return plan with correct fields', () => {
    expect(body.data.name).toContain('TPM Test Plan');
    expect(body.data.baseWeekday).toBe(1);
    expect(body.data.baseRepeatEvery).toBe(1);
    expect(body.data.baseTime).toBe('08:00:00');
    expect(body.data.assetId).toBeDefined();
    expect(body.data.isActive).toBe(1);
  });

  it('should start at approval version v0.0', () => {
    expect(body.data.approvalVersion).toBe(0);
    expect(body.data.revisionMinor).toBe(0);
  });
});

// ---- seq: 2 -- Plan Duplicate (same asset) ----------------------------------

describe('TPM: Plan Duplicate', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        assetUuid,
        name: 'Duplicate Plan',
        baseWeekday: 3,
        baseRepeatEvery: 2,
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 409 Conflict for same asset', () => {
    expect(res.status).toBe(409);
  });

  it('should return error response', () => {
    expect(body.success).toBe(false);
  });
});

// ---- seq: 3 -- List Plans ------------------------------------------------------

describe('TPM: List Plans', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return plans array', () => {
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should return pagination meta', () => {
    expect(body.data.total).toBeDefined();
    expect(typeof body.data.total).toBe('number');
    expect(body.data.page).toBe(1);
  });
});

// ---- seq: 4 -- Get Single Plan -------------------------------------------------

describe('TPM: Get Single Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return plan with matching uuid', () => {
    expect(body.data.uuid).toBe(planUuid);
  });

  it('should include asset name', () => {
    expect(body.data.assetName).toBeDefined();
    expect(typeof body.data.assetName).toBe('string');
  });
});

// ---- seq: 5 -- Update Plan -----------------------------------------------------

describe('TPM: Update Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Updated TPM Plan',
        baseWeekday: 4,
        notes: 'Updated via API test',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated fields', () => {
    expect(body.data.name).toBe('Updated TPM Plan');
    expect(body.data.baseWeekday).toBe(4);
    expect(body.data.notes).toBe('Updated via API test');
  });

  it('should bump revisionMinor on edit', () => {
    expect(body.data.revisionMinor).toBe(1);
    expect(body.data.approvalVersion).toBe(0);
  });
});

// ---- seq: 5a -- Approval: Verify request was created after plan create/update ----

describe('TPM Approval: Verify approval request created', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/approvals?addonCode=tpm`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should have at least one TPM approval', () => {
    const items = body.data?.items as JsonBody[] | undefined;
    expect(items).toBeDefined();
    expect(items!.length).toBeGreaterThanOrEqual(1);
  });

  it('should reference the created plan as source', () => {
    const items = body.data?.items as JsonBody[];
    const tpmApproval = items.find(
      (a: JsonBody) => a.sourceUuid === planUuid && a.addonCode === 'tpm',
    );
    expect(tpmApproval).toBeDefined();
    expect(tpmApproval!.sourceEntityType).toBe('tpm_plan');
    expect(tpmApproval!.status).toBe('pending');
  });

  it('should include plan name in approval title', () => {
    const items = body.data?.items as JsonBody[];
    const tpmApproval = items.find((a: JsonBody) => a.sourceUuid === planUuid);
    expect(tpmApproval!.title).toContain('TPM Plan:');
  });
});

// ---- seq: 5b -- Approval: Second edit should NOT create new approval (D3) --------

describe('TPM Approval: Edit with pending — no duplicate (D3)', () => {
  let updateRes: Response;
  let updateBody: JsonBody;
  let approvalsRes: Response;
  let approvalsBody: JsonBody;

  beforeAll(async () => {
    // Second edit
    updateRes = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ notes: 'Second edit — D3 test' }),
    });
    updateBody = (await updateRes.json()) as JsonBody;

    // Small delay for async approval processing
    await new Promise((r: (v: void) => void) => {
      setTimeout(r, 200);
    });

    // Check approvals count
    approvalsRes = await fetch(`${BASE_URL}/approvals?addonCode=tpm`, {
      headers: authOnly(auth.authToken),
    });
    approvalsBody = (await approvalsRes.json()) as JsonBody;
  });

  it('should bump revisionMinor to 2', () => {
    expect(updateRes.status).toBe(200);
    expect(updateBody.data.revisionMinor).toBe(2);
  });

  it('should still have only one pending TPM approval for this plan', () => {
    const items = approvalsBody.data?.items as JsonBody[];
    const tpmPending = items.filter(
      (a: JsonBody) => a.sourceUuid === planUuid && a.addonCode === 'tpm' && a.status === 'pending',
    );
    expect(tpmPending.length).toBe(1);
  });
});

// ---- seq: 5c -- Approval: approvalStatus visible in list plans -------------------

describe('TPM Approval: approvalStatus in list plans', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should include approvalStatus field on plans', () => {
    const plans = body.data?.data as JsonBody[];
    const plan = plans.find((p: JsonBody) => p.uuid === planUuid);
    expect(plan).toBeDefined();
    expect(plan!.approvalStatus).toBe('pending');
    expect(plan!.approvalVersion).toBe(0);
    expect(plan!.revisionMinor).toBe(2);
  });
});

// ---- seq: 5d -- Approval: approvalStatus in single plan --------------------------

describe('TPM Approval: approvalStatus in single plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should include approval fields', () => {
    expect(body.data.approvalStatus).toBe('pending');
    expect(body.data.approvalDecisionNote).toBeNull();
    expect(body.data.approvalDecidedByName).toBeNull();
  });
});

// ---- seq: 6 -- Set Time Estimate -----------------------------------------------

describe('TPM: Set Time Estimate', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/time-estimates`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        planUuid,
        intervalType: 'weekly',
        staffCount: 2,
        preparationMinutes: 10,
        executionMinutes: 30,
        followupMinutes: 5,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      timeEstimateUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return estimate with correct values', () => {
    expect(body.data.intervalType).toBe('weekly');
    expect(body.data.staffCount).toBe(2);
    expect(body.data.preparationMinutes).toBe(10);
    expect(body.data.executionMinutes).toBe(30);
    expect(body.data.followupMinutes).toBe(5);
  });

  it('should include computed totalMinutes', () => {
    expect(body.data.totalMinutes).toBe(45);
  });
});

// ---- seq: 7 -- Get Time Estimates ----------------------------------------------

describe('TPM: Get Time Estimates', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/time-estimates`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return array with at least 1 estimate', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should contain the created estimate', () => {
    const found = (body.data as Array<{ uuid: string }>).find(
      (e: { uuid: string }) => e.uuid === timeEstimateUuid,
    );
    expect(found).toBeDefined();
  });
});

// ---- seq: 8 -- Create Card -----------------------------------------------------

describe('TPM: Create Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        planUuid,
        cardRole: 'operator',
        intervalType: 'weekly',
        title: `Sichtprüfung ${Date.now()}`,
        description: 'Visuelle Kontrolle aller Anschlüsse',
        requiresApproval: false,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      cardUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return card with uuid', () => {
    expect(body.data.uuid).toBeDefined();
    expect(typeof body.data.uuid).toBe('string');
  });

  it('should auto-generate cardCode with BW prefix (operator+weekly)', () => {
    expect(body.data.cardCode).toBeDefined();
    expect(body.data.cardCode).toMatch(/^BW\d+$/);
  });

  it('should set intervalOrder automatically', () => {
    expect(body.data.intervalOrder).toBe(2); // weekly = 2
  });

  it('should default status to green', () => {
    expect(body.data.status).toBe('green');
  });
});

// ---- seq: 9 -- Check Duplicate -------------------------------------------------

describe('TPM: Check Duplicate', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/check-duplicate`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        planUuid,
        title: 'Sichtprüfung',
        intervalType: 'daily',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return duplicate check result', () => {
    expect(typeof body.data.hasDuplicate).toBe('boolean');
    expect(Array.isArray(body.data.existingCards)).toBe(true);
  });
});

// ---- seq: 10 -- List Cards by Plan ---------------------------------------------

describe('TPM: List Cards by Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards?planUuid=${planUuid}&page=1&limit=20`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return cards array with at least 1 card', () => {
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should return pagination info', () => {
    expect(body.data.total).toBeDefined();
    expect(typeof body.data.total).toBe('number');
  });
});

// ---- seq: 11 -- List Cards without filter → 400 --------------------------------

describe('TPM: List Cards without filter', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards?page=1&limit=20`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 12 -- Get Single Card ------------------------------------------------

describe('TPM: Get Single Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/${cardUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return card with matching uuid', () => {
    expect(body.data.uuid).toBe(cardUuid);
  });

  it('should include plan and asset references', () => {
    expect(body.data.planUuid).toBeDefined();
    expect(body.data.assetId).toBeDefined();
  });
});

// ---- seq: 13 -- Update Card ----------------------------------------------------

describe('TPM: Update Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/${cardUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Aktualisierte Sichtprüfung',
        description: 'Erweiterte Kontrolle',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated fields', () => {
    expect(body.data.title).toBe('Aktualisierte Sichtprüfung');
    expect(body.data.description).toBe('Erweiterte Kontrolle');
  });
});

// ---- seq: 14 -- Board Data -----------------------------------------------------

describe('TPM: Board Data', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/board?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return cards array', () => {
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should return pagination info', () => {
    expect(body.data.total).toBeDefined();
    expect(typeof body.data.total).toBe('number');
  });
});

// ---- seq: 15 -- Get Plan not found → 404 ---------------------------------------

describe('TPM: Plan Not Found', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/019fffff-ffff-7fff-bfff-ffffffffffff`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 404 for non-existent plan', () => {
    expect(res.status).toBe(404);
  });
});

// ---- seq: 16 -- Card Not Found → 404 -------------------------------------------

describe('TPM: Card Not Found', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/019fffff-ffff-7fff-bfff-ffffffffffff`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 404 for non-existent card', () => {
    expect(res.status).toBe(404);
  });
});

// ---- seq: 17 -- Create Card with maintenance role ------------------------------

describe('TPM: Create Maintenance Card', () => {
  let res: Response;
  let body: JsonBody;
  let maintenanceCardUuid: string;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        planUuid,
        cardRole: 'maintenance',
        intervalType: 'monthly',
        title: `Ölwechsel ${Date.now()}`,
        description: 'Motoröl wechseln und Filter tauschen',
        requiresApproval: true,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      maintenanceCardUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should auto-generate cardCode with IM prefix (maintenance+monthly)', () => {
    expect(body.data.cardCode).toBeDefined();
    expect(body.data.cardCode).toMatch(/^IM\d+$/);
  });

  it('should set requiresApproval to true', () => {
    expect(body.data.requiresApproval).toBe(true);
  });

  it('should set intervalOrder for monthly', () => {
    expect(body.data.intervalOrder).toBe(3); // monthly = 3
  });

  afterAll(async () => {
    // Cleanup: delete maintenance card
    if (maintenanceCardUuid) {
      await fetch(`${BASE_URL}/tpm/cards/${maintenanceCardUuid}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });
});

// ---- seq: 18 -- Archive Plan ---------------------------------------------------

describe('TPM: Archive Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/archive`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success message', () => {
    expect(body.data.message).toBe('Wartungsplan archiviert');
  });

  it('should return plan in response', () => {
    expect(body.data.plan).toBeDefined();
    expect(body.data.plan.uuid).toBe(planUuid);
  });
});

// ---- seq: 19 -- Verify archived plan is still accessible via GET ---------------

describe('TPM: Get Archived Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK (archived plans are readable)', () => {
    expect(res.status).toBe(200);
  });

  it('should have isActive = 3', () => {
    expect(body.data.isActive).toBe(3);
  });
});

// ---- seq: 20 -- Unarchive Plan -------------------------------------------------

describe('TPM: Unarchive Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/unarchive`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success message', () => {
    expect(body.data.message).toBe('Wartungsplan wiederhergestellt');
  });
});

// ---- seq: 21 -- Verify unarchived plan is active again -------------------------

describe('TPM: Verify Plan Restored', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should have isActive = 1', () => {
    expect(body.data.isActive).toBe(1);
  });
});

// ---- seq: 22 -- Plan Defects (Gesamtmängelliste) --------------------------------

describe('TPM: Plan Defects — Empty Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defects?page=1&limit=50`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return paginated structure', () => {
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.page).toBe('number');
    expect(typeof body.data.pageSize).toBe('number');
    expect(Array.isArray(body.data.data)).toBe(true);
  });

  it('should return empty data for plan without defects', () => {
    expect(body.data.total).toBe(0);
    expect(body.data.data.length).toBe(0);
  });
});

describe('TPM: Plan Defects — Unauthenticated', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defects?page=1&limit=50`);
  });

  it('should return 401 without auth', () => {
    expect(res.status).toBe(401);
  });
});

// ---- seq: 23 -- Cleanup: Delete Card -------------------------------------------

describe('TPM: Delete Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/${cardUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success message', () => {
    expect(body.data.message).toBe('TPM-Karte gelöscht');
  });
});

// ---- seq: 19 -- Cleanup: Delete Plan -------------------------------------------

describe('TPM: Delete Plan', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success message', () => {
    expect(body.data.message).toBe('Wartungsplan gelöscht');
  });
});

// ---- seq: 20 -- Verify delete (plan should be 404 now) -------------------------

describe('TPM: Verify Plan Deleted', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 404 after deletion', () => {
    expect(res.status).toBe(404);
  });
});

// ---- Defect Stats (Mängelgrafik) -------------------------------------------

describe('GET /tpm/plans/:uuid/defect-stats', () => {
  describe('authenticated', () => {
    let res: Response;
    let body: JsonBody;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defect-stats?year=2026`, {
        headers: authOnly(auth.authToken),
      });
      body = (await res.json()) as JsonBody;
    });

    it('should return 200', () => {
      expect(res.status).toBe(200);
    });

    it('should have correct structure', () => {
      const data = body.data as Record<string, unknown>;
      expect(data.year).toBe(2026);
      expect(data.assetName).toEqual(expect.any(String));
      expect(data.planName).toEqual(expect.any(String));
      expect(data.baseDetected).toEqual(expect.any(Number));
      expect(data.baseResolved).toEqual(expect.any(Number));
      expect(data.totalDetected).toEqual(expect.any(Number));
      expect(data.totalResolved).toEqual(expect.any(Number));
      expect(data.availableYears).toEqual(expect.any(Array));
    });

    it('should return 52 weeks', () => {
      const data = body.data as Record<string, unknown>;
      const weeks = data.weeks as unknown[];
      expect(weeks).toHaveLength(52);
    });

    it('should have correct week structure', () => {
      const data = body.data as Record<string, unknown>;
      const weeks = data.weeks as Record<string, unknown>[];
      const firstWeek = weeks[0]!;
      expect(firstWeek.week).toBe(1);
      expect(firstWeek).toHaveProperty('detected');
      expect(firstWeek).toHaveProperty('resolved');
      expect(firstWeek).toHaveProperty('cumulativeDetected');
      expect(firstWeek).toHaveProperty('cumulativeResolved');
    });
  });

  describe('default year (omitted)', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defect-stats`, {
        headers: authOnly(auth.authToken),
      });
    });

    it('should return 200 with default year', () => {
      expect(res.status).toBe(200);
    });
  });

  describe('invalid year', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defect-stats?year=abc`, {
        headers: authOnly(auth.authToken),
      });
    });

    it('should return 400', () => {
      expect(res.status).toBe(400);
    });
  });

  describe('non-existent plan', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/tpm/plans/00000000-0000-0000-0000-000000000000/defect-stats`, {
        headers: authOnly(auth.authToken),
      });
    });

    it('should return 404', () => {
      expect(res.status).toBe(404);
    });
  });

  describe('unauthenticated', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/tpm/plans/${planUuid}/defect-stats`);
    });

    it('should return 401', () => {
      expect(res.status).toBe(401);
    });
  });
});

// ---- Cleanup: delete assets created for this suite ----------------------------

afterAll(async () => {
  // Cleanup approval config
  if (approvalConfigUuid !== null) {
    await fetch(`${BASE_URL}/approvals/configs/${approvalConfigUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }

  if (assetUuids.length > 0) {
    await deleteAssets(auth.authToken, assetUuids);
  }
});
