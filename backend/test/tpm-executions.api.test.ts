/**
 * TPM Executions + Config API Integration Tests (Session 20)
 *
 * Covers Execution lifecycle, Config CRUD (Escalation, Colors, Templates),
 * and Slot Assistant. Runs against REAL backend (Docker must be running).
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

// Shared state across sequential describe blocks
let machineUuid: string;
let planUuid: string;
let cardUuid: string;
let templateUuid: string;

beforeAll(async () => {
  auth = await loginApitest();

  // Find an available machine
  const machinesRes = await fetch(`${BASE_URL}/machines?limit=10`, {
    headers: authOnly(auth.authToken),
  });
  const machinesBody = (await machinesRes.json()) as JsonBody;
  const machines = machinesBody.data as Array<{ uuid: string; name: string }>;
  const second = machines[1];
  if (second === undefined) {
    throw new Error('Need at least 2 machines in apitest tenant for TPM tests');
  }
  machineUuid = second.uuid;

  // Create plan for execution + slot tests
  const planRes = await fetch(`${BASE_URL}/tpm/plans`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      machineUuid,
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
    const green = (
      body.data as Array<{ statusKey: string; colorHex: string }>
    ).find((c: { statusKey: string }) => c.statusKey === 'green');
    expect(green).toBeDefined();
    expect(green?.colorHex).toBe('#22c55e');
  });
});

// ============================================================================
// CONFIG — TEMPLATES
// ============================================================================

// ---- seq: 7 -- Create Template -------------------------------------------------

describe('TPM Config: Create Template', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/templates`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: `Test Template ${Date.now()}`,
        description: 'API test template',
        defaultFields: { checkOil: true, checkFilter: false },
        isDefault: false,
      }),
    });
    body = (await res.json()) as JsonBody;

    if (res.status === 201) {
      templateUuid = body.data.uuid as string;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('should return template with uuid', () => {
    expect(body.data.uuid).toBeDefined();
    expect(typeof body.data.uuid).toBe('string');
  });

  it('should store JSONB defaultFields', () => {
    expect(body.data.defaultFields).toEqual({
      checkOil: true,
      checkFilter: false,
    });
  });
});

// ---- seq: 8 -- List Templates --------------------------------------------------

describe('TPM Config: List Templates', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/templates`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return array with at least 1 template', () => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should contain the created template', () => {
    const found = (body.data as Array<{ uuid: string }>).find(
      (t: { uuid: string }) => t.uuid === templateUuid,
    );
    expect(found).toBeDefined();
  });
});

// ---- seq: 9 -- Update Template -------------------------------------------------

describe('TPM Config: Update Template', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/templates/${templateUuid}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        name: 'Updated Template',
        description: 'Updated via API test',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return updated fields', () => {
    expect(body.data.name).toBe('Updated Template');
    expect(body.data.description).toBe('Updated via API test');
  });

  it('should preserve JSONB defaultFields', () => {
    expect(body.data.defaultFields).toEqual({
      checkOil: true,
      checkFilter: false,
    });
  });
});

// ---- seq: 10 -- Delete Template ------------------------------------------------

describe('TPM Config: Delete Template', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/tpm/config/templates/${templateUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success message', () => {
    expect(body.data.message).toBe('Kartenvorlage gelöscht');
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

// ---- seq: 12 -- List Pending Approvals -----------------------------------------

describe('TPM Exec: Pending Approvals', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(
      `${BASE_URL}/tpm/executions/pending-approvals?page=1&limit=10`,
      {
        headers: authOnly(auth.authToken),
      },
    );
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
    res = await fetch(
      `${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff`,
      {
        headers: authOnly(auth.authToken),
      },
    );
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
    res = await fetch(
      `${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff/respond`,
      {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({
          action: 'rejected',
        }),
      },
    );
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
    res = await fetch(
      `${BASE_URL}/tpm/executions/019fffff-ffff-7fff-bfff-ffffffffffff/photos`,
      {
        headers: authOnly(auth.authToken),
      },
    );
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
});
