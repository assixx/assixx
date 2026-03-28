/**
 * TPM Executions + Config API Integration Tests (Session 20)
 *
 * Covers Execution lifecycle, Config CRUD (Escalation, Colors, Templates),
 * and Slot Assistant. Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import { execSync } from 'node:child_process';

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
let executionUuid: string;
/** Force a card's status via direct DB update (test-only) */
function forceCardStatus(uuid: string, status: string): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "UPDATE tpm_cards SET status = '${status}' WHERE uuid = '${uuid}'"`,
    { stdio: 'pipe' },
  );
}

beforeAll(async () => {
  auth = await loginApitest();

  // Create 2 assets (this suite needs the 2nd one)
  assetUuids = await createAssets(auth.authToken, 2);
  assetUuid = assetUuids[1]!;

  // Create plan for execution + slot tests
  const planRes = await fetch(`${BASE_URL}/tpm/plans`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      assetUuid,
      name: `TPM Exec Test Plan ${Date.now()}`,
      baseWeekday: 2,
      baseRepeatEvery: 1,
      baseTime: '09:00',
      shiftPlanRequired: false,
    }),
  });
  const planBody = (await planRes.json()) as JsonBody;
  if (planRes.status !== 201) {
    throw new Error(`Plan creation failed: ${planRes.status}`);
  }
  planUuid = planBody.data.uuid as string;

  // Create card for execution tests (no approval required)
  const cardRes = await fetch(`${BASE_URL}/tpm/cards`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      planUuid,
      cardRole: 'operator',
      intervalType: 'daily',
      title: `Exec Test Card ${Date.now()}`,
      description: 'Card for execution API testing',
      requiresApproval: false,
    }),
  });
  const cardBody = (await cardRes.json()) as JsonBody;
  if (cardRes.status !== 201) {
    throw new Error(`Card creation failed: ${cardRes.status}`);
  }
  cardUuid = cardBody.data.uuid as string;
});

// ============================================================================
// CONFIG — ESCALATION
// ============================================================================

// ---- seq: 1 -- Get Escalation Config (defaults) --------------------------------

describe('TPM Config: Get Escalation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/escalation`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return default escalation config', () => {
    expect(body.data.escalationAfterHours).toBeDefined();
    expect(typeof body.data.escalationAfterHours).toBe('number');
    expect(typeof body.data.notifyTeamLead).toBe('boolean');
    expect(typeof body.data.notifyDepartmentLead).toBe('boolean');
  });
});

// ---- seq: 2 -- Update Escalation Config ----------------------------------------

describe('TPM Config: Update Escalation', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/escalation`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        escalationAfterHours: 24,
        notifyTeamLead: true,
        notifyDepartmentLead: true,
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated values', () => {
    expect(body.data.escalationAfterHours).toBe(24);
    expect(body.data.notifyTeamLead).toBe(true);
    expect(body.data.notifyDepartmentLead).toBe(true);
  });
});

// ---- seq: 3 -- Verify Escalation Persistence -----------------------------------

describe('TPM Config: Verify Escalation Persistence', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/escalation`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return persisted values', () => {
    expect(body.data.escalationAfterHours).toBe(24);
    expect(body.data.notifyDepartmentLead).toBe(true);
  });
});

// ============================================================================
// CONFIG — COLORS
// ============================================================================

// ---- seq: 4 -- Get Colors (defaults) -------------------------------------------

describe('TPM Config: Get Colors', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/colors`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return 4 color entries', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(4);
  });

  it('should contain all status keys', () => {
    const keys = (body.data as Array<{ statusKey: string }>).map(
      (c: { statusKey: string }) => c.statusKey,
    );
    expect(keys).toContain('green');
    expect(keys).toContain('red');
    expect(keys).toContain('yellow');
    expect(keys).toContain('overdue');
  });
});

// ---- seq: 5 -- Update Color ----------------------------------------------------

describe('TPM Config: Update Color', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/colors`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        statusKey: 'green',
        colorHex: '#00ff00',
        label: 'Alles OK',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated color', () => {
    expect(body.data.statusKey).toBe('green');
    expect(body.data.colorHex).toBe('#00ff00');
    expect(body.data.label).toBe('Alles OK');
  });
});

// ---- seq: 6 -- Reset Colors to Defaults ----------------------------------------

describe('TPM Config: Reset Colors', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/colors/reset`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return 4 default colors', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(4);
  });

  it('should restore green default hex', () => {
    const green = (body.data as Array<{ statusKey: string; colorHex: string }>).find(
      (c: { statusKey: string }) => c.statusKey === 'green',
    );
    expect(green).toBeDefined();
    expect(green?.colorHex).toBe('#22c55e');
  });
});

// ============================================================================
// EXECUTIONS
// ============================================================================

// ---- seq: 11 -- Execute green card → 400 (invalid state) ----------------------

describe('TPM Exec: Execute Green Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        cardUuid,
        documentation: 'Test execution on green card',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 Bad Request (card is green, not red/overdue)', () => {
    expect(res.status).toBe(400);
  });

  it('should return error about invalid status', () => {
    expect(body.success).toBe(false);
  });
});

// ---- seq: 11b -- Execute red card with enhanced fields → 201 -------------------

describe('TPM Exec: Execute Red Card With Enhanced Fields', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Force card to 'red' so it can be executed
    forceCardStatus(cardUuid, 'red');

    res = await fetch(`${BASE_URL}/tpm/executions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        cardUuid,
        executionDate: '2026-02-20',
        noIssuesFound: true,
        actualDurationMinutes: 45,
        actualStaffCount: 2,
        documentation: 'Routine-Wartung abgeschlossen',
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      executionUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return noIssuesFound in response', () => {
    expect(body.data.noIssuesFound).toBe(true);
  });

  it('should return actualDurationMinutes in response', () => {
    expect(body.data.actualDurationMinutes).toBe(45);
  });

  it('should return actualStaffCount in response', () => {
    expect(body.data.actualStaffCount).toBe(2);
  });

  it('should return executionDate matching input', () => {
    expect(body.data.executionDate).toContain('2026-02-20');
  });
});

// ---- seq: 11c -- Get execution and verify enhanced fields persist ---------------

describe('TPM Exec: Verify Enhanced Fields Persist', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/${executionUuid}`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should persist noIssuesFound', () => {
    expect(body.data.noIssuesFound).toBe(true);
  });

  it('should persist actualDurationMinutes', () => {
    expect(body.data.actualDurationMinutes).toBe(45);
  });

  it('should persist actualStaffCount', () => {
    expect(body.data.actualStaffCount).toBe(2);
  });
});

// ---- seq: 11d -- Execute with invalid duration → 400 ----------------------------

describe('TPM Exec: Invalid Enhanced Fields', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Force card back to 'red' for another attempt
    forceCardStatus(cardUuid, 'red');

    res = await fetch(`${BASE_URL}/tpm/executions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        cardUuid,
        actualDurationMinutes: 0,
        actualStaffCount: -1,
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 for invalid field values', () => {
    expect(res.status).toBe(400);
  });

  it('should return validation error', () => {
    expect(body.success).toBe(false);
  });
});

// ---- seq: 11e -- Approval card without docs when noIssuesFound=true → 201 -------

describe('TPM Exec: Approval Card No Docs With NoIssuesFound', () => {
  let approvalCardUuid: string;
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Create a card that requires approval
    const cardRes = await fetch(`${BASE_URL}/tpm/cards`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        planUuid,
        cardRole: 'operator',
        intervalType: 'daily',
        title: `Approval Test Card ${Date.now()}`,
        requiresApproval: true,
      }),
    });
    const cardBody = (await cardRes.json()) as JsonBody;
    approvalCardUuid = cardBody.data.uuid as string;

    // Force to red
    forceCardStatus(approvalCardUuid, 'red');

    // Execute with noIssuesFound=true and NO documentation
    res = await fetch(`${BASE_URL}/tpm/executions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        cardUuid: approvalCardUuid,
        noIssuesFound: true,
      }),
    });
    body = (await res.json()) as JsonBody;

    // Cleanup: delete the approval test card
    await fetch(`${BASE_URL}/tpm/cards/${approvalCardUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 201 Created (docs not required when noIssuesFound)', () => {
    expect(res.status).toBe(201);
  });

  it('should have pending approval status', () => {
    expect(body.data.approvalStatus).toBe('pending');
  });

  it('should have noIssuesFound=true', () => {
    expect(body.data.noIssuesFound).toBe(true);
  });
});

// ---- seq: 12 -- List Pending Approvals -----------------------------------------

describe('TPM Exec: Pending Approvals', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/pending-approvals?page=1&limit=10`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return paginated structure', () => {
    expect(body.data.total).toBeDefined();
    expect(typeof body.data.total).toBe('number');
    expect(Array.isArray(body.data.data)).toBe(true);
  });
});

// ---- seq: 13 -- Get Non-existent Execution → 404 -------------------------------

describe('TPM Exec: Not Found', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 404 for non-existent execution', () => {
    expect(res.status).toBe(404);
  });
});

// ---- seq: 14 -- Reject without note → Validation Error -------------------------

describe('TPM Exec: Reject Without Note', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff/respond`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        action: 'rejected',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 Validation Error (note required for rejection)', () => {
    expect(res.status).toBe(400);
  });

  it('should return validation error response', () => {
    expect(body.success).toBe(false);
  });
});

// ---- seq: 15 -- Get Execution Photos (non-existent) → 404 ----------------------

describe('TPM Exec: Photos Empty', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff/photos`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK (empty array for non-existent execution)', () => {
    expect(res.status).toBe(200);
  });

  it('should return empty array', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });
});

// ============================================================================
// DEFECT PHOTOS
// ============================================================================

// Module-scoped state for defect photo tests (populated in seq 15b)
let defectUuid: string;

// ---- seq: 15b -- Create Execution With Defect → extract defectUuid ----------

describe('TPM Defect Photos: Create Execution With Defect', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    forceCardStatus(cardUuid, 'red');

    res = await fetch(`${BASE_URL}/tpm/executions`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        cardUuid,
        noIssuesFound: false,
        documentation: 'Mangel festgestellt bei Sichtprüfung',
        defects: [{ title: 'Riss am Gehäuse', description: 'Haarriss Position 3' }],
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201 && Array.isArray(body.data.defects)) {
      defectUuid = (body.data.defects as Array<{ uuid: string }>)[0]!.uuid;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should include defects array with uuid', () => {
    expect(Array.isArray(body.data.defects)).toBe(true);
    expect(body.data.defects.length).toBe(1);
    expect(typeof body.data.defects[0].uuid).toBe('string');
  });
});

// ---- seq: 15c -- Get Defect Photos (empty) ----------------------------------

describe('TPM Defect Photos: Get Empty', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}/photos`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return empty array', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });
});

// ---- seq: 15d -- Upload Defect Photo ----------------------------------------

describe('TPM Defect Photos: Upload', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    const formData = new FormData();
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
    formData.append('file', new File([jpegBytes], 'riss.jpg', { type: 'image/jpeg' }));

    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return photo with uuid and fileName', () => {
    expect(typeof body.data.uuid).toBe('string');
    expect(body.data.fileName).toBe('riss.jpg');
  });

  it('should return correct mimeType', () => {
    expect(body.data.mimeType).toBe('image/jpeg');
  });
});

// ---- seq: 15e -- Get Defect Photos (after upload) ---------------------------

describe('TPM Defect Photos: Get After Upload', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}/photos`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return 1 photo', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
  });

  it('should return the uploaded photo details', () => {
    expect(body.data[0].fileName).toBe('riss.jpg');
    expect(body.data[0].mimeType).toBe('image/jpeg');
    expect(typeof body.data[0].filePath).toBe('string');
  });
});

// ---- seq: 15f -- Get Defect Photos (non-existent defect) → empty ------------

describe('TPM Defect Photos: Non-Existent Defect', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/tpm/executions/defects/019fffff-ffff-7fff-bfff-ffffffffffff/photos`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK (empty array)', () => {
    expect(res.status).toBe(200);
  });

  it('should return empty array', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });
});

// ============================================================================
// DEFECTS LIST (Mängelliste with Work Order Context)
// ============================================================================

// ---- seq: 15g -- List Defects For Card (with work order fields) -------------

describe('TPM Defects: List For Card', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/cards/${cardUuid}/defects?page=1&limit=50`, {
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

  it('should include defect with execution context fields', () => {
    expect(body.data.data.length).toBeGreaterThanOrEqual(1);
    const defect = body.data.data[0];
    expect(typeof defect.uuid).toBe('string');
    expect(typeof defect.title).toBe('string');
    expect(typeof defect.executionUuid).toBe('string');
    expect(typeof defect.executionDate).toBe('string');
    expect(typeof defect.photoCount).toBe('number');
    expect(typeof defect.createdAt).toBe('string');
  });

  it('should include work order fields (null when no WO)', () => {
    const defect = body.data.data[0];
    expect(defect).toHaveProperty('workOrderUuid');
    expect(defect).toHaveProperty('workOrderStatus');
    expect(defect).toHaveProperty('workOrderPriority');
    expect(defect).toHaveProperty('workOrderAssigneeNames');
    expect(defect).toHaveProperty('workOrderCreatedAt');
    expect(Array.isArray(defect.workOrderAssigneeNames)).toBe(true);
    expect(defect.workOrderAssigneeNames.length).toBe(0);
  });
});

// ============================================================================
// DEFECT UPDATE (PATCH)
// ============================================================================

// ---- seq: 15h -- Update Defect Title ----------------------------------------

describe('TPM Defects: Update Title', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ title: 'Aktualisierter Mangeltitel' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated title', () => {
    expect(body.data.title).toBe('Aktualisierter Mangeltitel');
  });

  it('should preserve uuid', () => {
    expect(body.data.uuid).toBe(defectUuid);
  });
});

// ---- seq: 15i -- Update Defect Description ----------------------------------

describe('TPM Defects: Update Description', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ description: 'Neue Beschreibung' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated description', () => {
    expect(body.data.description).toBe('Neue Beschreibung');
  });

  it('should keep previously updated title', () => {
    expect(body.data.title).toBe('Aktualisierter Mangeltitel');
  });
});

// ---- seq: 15j -- Update Defect with empty body → 400 -----------------------

describe('TPM Defects: Update Empty Body', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/${defectUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
  });

  it('should return 400 for empty body', () => {
    expect(res.status).toBe(400);
  });
});

// ---- seq: 15k -- Update Non-Existent Defect → 404 --------------------------

describe('TPM Defects: Update Non-Existent', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/executions/defects/019fffff-ffff-7fff-bfff-ffffffffffff`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ title: 'Sollte fehlschlagen' }),
    });
  });

  it('should return 404 for non-existent defect', () => {
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// SLOT ASSISTANT
// ============================================================================

// ---- seq: 16 -- Available Slots ------------------------------------------------

describe('TPM: Slot Assistant', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    const startDate = '2026-03-01';
    const endDate = '2026-03-07';
    res = await fetch(
      `${BASE_URL}/tpm/plans/${planUuid}/available-slots?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return slot availability structure', () => {
    expect(body.data).toBeDefined();
    expect(typeof body.data).toBe('object');
  });
});

// ---- seq: 17 -- Slot Assistant invalid dates → 422 -----------------------------

describe('TPM: Slot Assistant Invalid Dates', () => {
  let res: Response;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/tpm/plans/${planUuid}/available-slots?startDate=invalid&endDate=also-invalid`,
      {
        headers: authOnly(auth.authToken),
      },
    );
  });

  it('should return 400 for invalid date format', () => {
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

afterAll(async () => {
  // Delete card first (FK dependency)
  if (cardUuid) {
    await fetch(`${BASE_URL}/tpm/cards/${cardUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }

  // Delete plan
  if (planUuid) {
    await fetch(`${BASE_URL}/tpm/plans/${planUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }

  // Delete assets created for this suite
  if (assetUuids.length > 0) {
    await deleteAssets(auth.authToken, assetUuids);
  }
});
