/**
 * KVP API Integration Tests
 *
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
  createDepartmentAndTeam,
  ensureTestEmployee,
  loginApitest,
} from './helpers.js';

let auth: AuthState;

// Shared state across sequential describe blocks
let kvpId: number | undefined;
let _existingKvpId: number;
let _createdKvpId: number;

// Team setup — KVP requires team assignment
let testTeamId: number;
let testDepartmentId: number;

beforeAll(async () => {
  auth = await loginApitest();

  // KVP requires the user to be assigned to a team
  const { departmentId, teamId } = await createDepartmentAndTeam(auth.authToken);
  testDepartmentId = departmentId;
  testTeamId = teamId;

  // Assign test user to team
  const assignRes = await fetch(`${BASE_URL}/teams/${testTeamId}/members`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({ userId: auth.userId }),
  });
  if (assignRes.status !== 201 && assignRes.status !== 409) {
    throw new Error(`Team member assignment failed: ${assignRes.status}`);
  }
});

afterAll(async () => {
  if (!auth) return;

  // Remove user from team
  await fetch(`${BASE_URL}/teams/${testTeamId}/members/${auth.userId}`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });

  // Delete team (force) and department
  await fetch(`${BASE_URL}/teams/${testTeamId}?force=true`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });
  await fetch(`${BASE_URL}/departments/${testDepartmentId}?force=true`, {
    method: 'DELETE',
    headers: authOnly(auth.authToken),
  });
});

// ---- seq: 0 -- KVP Settings (root-only) ------------------------------------

describe('KVP: Get Settings', () => {
  let settingsRes: Response;
  let settingsBody: JsonBody;

  beforeAll(async () => {
    settingsRes = await fetch(`${BASE_URL}/kvp/settings`, {
      headers: authOnly(auth.authToken),
    });
    settingsBody = (await settingsRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(settingsRes.status).toBe(200);
    expect(settingsBody.success).toBe(true);
  });

  it('should return dailyLimit as number', () => {
    expect(typeof settingsBody.data.dailyLimit).toBe('number');
    expect(settingsBody.data.dailyLimit).toBeGreaterThanOrEqual(0);
  });
});

describe('KVP: Update Settings', () => {
  let updateRes: Response;
  let updateBody: JsonBody;

  beforeAll(async () => {
    updateRes = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 5 }),
    });
    updateBody = (await updateRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(updateRes.status).toBe(200);
    expect(updateBody.success).toBe(true);
  });

  it('should return updated dailyLimit', () => {
    expect(updateBody.data.dailyLimit).toBe(5);
  });
});

describe('KVP: Verify Settings Persistence', () => {
  let verifyRes: Response;
  let verifyBody: JsonBody;

  beforeAll(async () => {
    verifyRes = await fetch(`${BASE_URL}/kvp/settings`, {
      headers: authOnly(auth.authToken),
    });
    verifyBody = (await verifyRes.json()) as JsonBody;
  });

  it('should return persisted dailyLimit = 5', () => {
    expect(verifyBody.data.dailyLimit).toBe(5);
  });
});

describe('KVP: Reset Settings to Default', () => {
  let resetRes: Response;
  let resetBody: JsonBody;

  beforeAll(async () => {
    resetRes = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 1 }),
    });
    resetBody = (await resetRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(resetRes.status).toBe(200);
    expect(resetBody.data.dailyLimit).toBe(1);
  });
});

describe('KVP: Settings Validation', () => {
  it('should reject negative dailyLimit', async () => {
    const res = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject dailyLimit > 100', async () => {
    const res = await fetch(`${BASE_URL}/kvp/settings`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ dailyLimit: 101 }),
    });
    expect(res.status).toBe(400);
  });
});

// ---- seq: 0b -- KVP Reward Tiers (root-only CRUD) ----------------------------

let createdTierId: number | undefined;

describe('KVP: List Reward Tiers (initially)', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/reward-tiers`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return an array', () => {
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('KVP: Create Reward Tier', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/reward-tiers`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ amount: 77.77 }),
    });
    body = (await res.json()) as JsonBody;
    if (res.status === 201 && body.data?.id) {
      createdTierId = body.data.id as number;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return tier with id, amount, sortOrder', () => {
    expect(body.data).toHaveProperty('id');
    expect(body.data.amount).toBe(77.77);
    expect(typeof body.data.sortOrder).toBe('number');
  });
});

describe('KVP: Create Duplicate Reward Tier', () => {
  it('should return 409 Conflict for duplicate amount', async () => {
    const res = await fetch(`${BASE_URL}/kvp/reward-tiers`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ amount: 77.77 }),
    });
    expect(res.status).toBe(409);
  });
});

describe('KVP: Verify Reward Tier in List', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/kvp/reward-tiers`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should contain the created tier', () => {
    expect(res.status).toBe(200);
    const tiers = body.data as Array<{ id: number; amount: number }>;
    const found = tiers.find((t: { id: number }) => t.id === createdTierId);
    expect(found).toBeDefined();
    expect(found?.amount).toBe(77.77);
  });
});

describe('KVP: Delete Reward Tier', () => {
  it('should return 204 No Content', async () => {
    if (createdTierId === undefined) return;
    const res = await fetch(`${BASE_URL}/kvp/reward-tiers/${createdTierId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(204);
  });

  it('should return 404 when deleting again', async () => {
    if (createdTierId === undefined) return;
    const res = await fetch(`${BASE_URL}/kvp/reward-tiers/${createdTierId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(404);
  });
});

// ---- seq: 1 -- List KVP Suggestions -----------------------------------------

describe('KVP: List Suggestions', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return suggestions array', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data.suggestions)).toBe(true);

    // Store first existing suggestion ID for fallback after delete
    if (body.data.suggestions.length > 0) {
      _existingKvpId = body.data.suggestions[0].id;
    }
  });

  it('should return pagination info', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.pagination).toBeDefined();
    expect(typeof body.data.pagination).toBe('object');
  });
});

// ---- seq: 2 -- Create KVP Suggestion ----------------------------------------

describe('KVP: Create Suggestion', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        description: 'Created via API test - will be deleted after testing',
        categoryId: 1,
        priority: 'normal',
        expectedBenefit: 'Test benefit for automation testing',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // Store created suggestion ID for subsequent tests (only if creation succeeded)
    if (res.status === 201 && body.data?.id) {
      kvpId = body.data.id;
      _createdKvpId = body.data.id;
    }

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 3 -- Get KVP Suggestion -------------------------------------------

describe('KVP: Get Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return suggestion object with id and title', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
  });
});

// ---- seq: 4 -- Update KVP Suggestion ----------------------------------------

describe('KVP: Update Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Updated Suggestion',
        priority: 'high',
        status: 'in_review',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Get KVP Categories -------------------------------------------

describe('KVP: Categories', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/kvp/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return categories array', async () => {
    const res = await fetch(`${BASE_URL}/kvp/categories`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 6 -- Get KVP Dashboard Statistics ----------------------------------

describe('KVP: Dashboard Statistics', () => {
  let statsRes: Response;
  let statsBody: JsonBody;

  beforeAll(async () => {
    statsRes = await fetch(`${BASE_URL}/kvp/dashboard/stats`, {
      headers: authOnly(auth.authToken),
    });
    statsBody = (await statsRes.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(statsRes.status).toBe(200);
    expect(statsBody.success).toBe(true);
  });

  it('should return tenant-wide statistics', () => {
    expect(statsBody.data).toHaveProperty('totalSuggestions');
    expect(statsBody.data).toHaveProperty('newSuggestions');
    expect(statsBody.data).toHaveProperty('inReviewSuggestions');
    expect(statsBody.data).toHaveProperty('approvedSuggestions');
    expect(statsBody.data).toHaveProperty('implementedSuggestions');
    expect(statsBody.data).toHaveProperty('rejectedSuggestions');
  });

  it('should return team-scoped statistics', () => {
    expect(typeof statsBody.data.teamTotalSuggestions).toBe('number');
    expect(typeof statsBody.data.teamImplementedSuggestions).toBe('number');
    expect(statsBody.data.teamTotalSuggestions).toBeGreaterThanOrEqual(0);
    expect(statsBody.data.teamImplementedSuggestions).toBeGreaterThanOrEqual(0);
  });

  it('should have teamImplemented <= teamTotal', () => {
    expect(statsBody.data.teamImplementedSuggestions).toBeLessThanOrEqual(
      statsBody.data.teamTotalSuggestions,
    );
  });
});

// ---- seq: 7 -- Get KVP Comments ---------------------------------------------

describe('KVP: Get Comments', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return paginated comments', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('comments');
    expect(Array.isArray(body.data.comments)).toBe(true);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('hasMore');
  });
});

// ---- seq: 8 -- Add KVP Comment -----------------------------------------------

describe('KVP: Add Comment', () => {
  it('should return 201 Created', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}/comments`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        comment: 'This is a test comment on the KVP suggestion.',
        isInternal: false,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 10 -- Delete KVP Suggestion ----------------------------------------

describe('KVP: Delete Suggestion', () => {
  it('should return 200 OK', async () => {
    if (!kvpId) return; // Skip if create failed (API bug)
    const res = await fetch(`${BASE_URL}/kvp/${kvpId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created ID and fall back to existing suggestion
    _createdKvpId = 0;
    if (_existingKvpId) {
      kvpId = _existingKvpId;
    }
  });
});

// ---- seq: 11 -- KVP Participants (FEAT_KVP_PARTICIPANTS_MASTERPLAN Phase 4) --
//
// API integration coverage for the participant-tagging feature. Reuses the
// outer `auth` (admin@apitest.de, root, tenant=1) and the team/department
// already created by the file-level beforeAll.
//
// Scope reconciliation vs masterplan §Phase 4 (logged as Spec Deviation #8):
//  • Scenario #3 reframed from "PATCH replaces participants → 200, response
//    reflects new list" to a V1-boundary assertion: PUT carrying a
//    `participants` field is silently stripped (UpdateSuggestionSchema does
//    not declare it; default Zod mode strips unknown keys), so the original
//    list survives. Honors Known Limitations §1 + Step 2.4 PATCH-row
//    "Unchanged in V1".
//  • Scenario #9 (creator-bypass for participants on PUT) skipped — same
//    root cause: participants are immutable post-create in V1. Reopen when
//    Edit UI lands (Step 5.3 deferred-work spec).
//  • Pagination/cap on /options (DoD bullet, no spec scenario) added as
//    test #11 — apitest tenant has 146 active users, the LIMIT 50 cap is
//    a real assertion.
//
// Sub-describe `addon disabled` placed last in this block so the `kvp`
// addon is reactivated before any subsequent test file. API project is
// `pool: 'forks', maxWorkers: 1, isolate: false` (vitest.config.ts) and
// runs files alphabetically — `kvp-approval.api.test.ts` already executed
// before this file, so the only post-restore consumer is this file's own
// `afterAll` (no-op for kvp). Reactivation flips status `cancelled` →
// `trial` per AddonsService.reactivateExisting() — functionally
// equivalent to `active` for AddonCheckService.
//
// @see docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §Phase 4 + Spec Deviation #8

describe('KVP: Participants', () => {
  let participantsKvpId: number | undefined;

  afterAll(async () => {
    if (participantsKvpId !== undefined) {
      await fetch(`${BASE_URL}/kvp/${participantsKvpId}`, {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      });
    }
  });

  // -- 1) POST with empty participants ---------------------------------------
  it('POST /kvp with participants:[] returns 201 and empty enriched list', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Phase4 Empty ${Date.now()}`,
        description: 'Phase 4 P1 — empty participants smoke test.',
        categoryId: 1,
        priority: 'normal',
        participants: [],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.participants)).toBe(true);
    expect(body.data.participants).toHaveLength(0);

    // Clean up immediately so we don't leave stray suggestions per test.
    await fetch(`${BASE_URL}/kvp/${body.data.id}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });

  // -- 2) POST with mixed types (1 user, 1 team, 1 department) ---------------
  it('POST /kvp with 3 mixed participants returns enriched list', async () => {
    const employeeId = await ensureTestEmployee(auth.authToken);

    const res = await fetch(`${BASE_URL}/kvp`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Phase4 Mixed ${Date.now()}`,
        description: 'Phase 4 P2 — user+team+department participants.',
        categoryId: 1,
        priority: 'normal',
        participants: [
          { type: 'user', id: employeeId },
          { type: 'team', id: testTeamId },
          { type: 'department', id: testDepartmentId },
        ],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    participantsKvpId = body.data.id as number;

    const ps = body.data.participants as Array<{
      type: string;
      id: number;
      label: string;
      sublabel?: string;
    }>;
    expect(ps).toHaveLength(3);
    expect(new Set(ps.map((p) => p.type))).toEqual(new Set(['user', 'team', 'department']));
    for (const p of ps) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  // -- 3) PUT silently strips participants (V1 boundary, see deviation #8) ---
  it('PUT /kvp/:id ignores `participants` (V1 immutability)', async () => {
    if (participantsKvpId === undefined) return;

    const updRes = await fetch(`${BASE_URL}/kvp/${participantsKvpId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Phase4 Mixed (after PUT)',
        // Attempt to wipe — must NOT take effect (Known Limitations §1).
        participants: [],
      }),
    });
    expect(updRes.status).toBe(200);

    const getRes = await fetch(`${BASE_URL}/kvp/${participantsKvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await getRes.json()) as JsonBody;
    expect((body.data.participants as unknown[]).length).toBe(3);
  });

  // -- 4) GET /kvp/:id returns enriched participants -------------------------
  it('GET /kvp/:id returns enriched participants matching create-time list', async () => {
    if (participantsKvpId === undefined) return;

    const res = await fetch(`${BASE_URL}/kvp/${participantsKvpId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const ps = body.data.participants as Array<{ type: string; id: number; label: string }>;
    expect(ps).toHaveLength(3);
    expect(new Set(ps.map((p) => p.type))).toEqual(new Set(['user', 'team', 'department']));
  });

  // -- 5) GET /options?q=<term> filters across all 4 types -------------------
  it('GET /kvp/participants/options?q=Test filters by query', async () => {
    const res = await fetch(`${BASE_URL}/kvp/participants/options?q=Test`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('users');
    expect(body.data).toHaveProperty('teams');
    expect(body.data).toHaveProperty('departments');
    expect(body.data).toHaveProperty('areas');

    const allRows = [
      ...(body.data.users as Array<{ label: string }>),
      ...(body.data.teams as Array<{ label: string }>),
      ...(body.data.departments as Array<{ label: string }>),
      ...(body.data.areas as Array<{ label: string }>),
    ];
    for (const row of allRows) {
      expect(row.label.toLowerCase()).toContain('test');
    }
  });

  // -- 6) GET /options?types=team,department narrows the response ------------
  it('GET /kvp/participants/options?types=team,department restricts response', async () => {
    const res = await fetch(`${BASE_URL}/kvp/participants/options?types=team,department`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    // Non-requested types must be empty arrays (still keys present).
    expect(body.data.users).toHaveLength(0);
    expect(body.data.areas).toHaveLength(0);
    expect(Array.isArray(body.data.teams)).toBe(true);
    expect(Array.isArray(body.data.departments)).toBe(true);
  });

  // -- 7) Cross-tenant isolation via non-existent target id ------------------
  // RLS auto-filters tenant scope; an ID not in this tenant is
  // indistinguishable from "doesn't exist" → service surfaces as 400 from
  // validateTargets. Closes risk R6 + the cross-tenant-leak half of R4 at
  // the API layer.
  it('POST /kvp with participant id outside tenant returns 400', async () => {
    const res = await fetch(`${BASE_URL}/kvp`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Phase4 Invalid ${Date.now()}`,
        description: 'Phase 4 P7 — RLS-scoped lookup rejection.',
        categoryId: 1,
        priority: 'normal',
        participants: [{ type: 'user', id: 99_999_999 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  // -- 10) Soft-deleted user not in /options ---------------------------------
  // user id=11 is_active=4 (DELETED) per DB seed snapshot. Service-side
  // SQL filter `is_active != IS_ACTIVE.DELETED` must keep them out.
  it('GET /kvp/participants/options excludes soft-deleted users', async () => {
    const res = await fetch(`${BASE_URL}/kvp/participants/options?q=`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const users = body.data.users as Array<{ id: number }>;
    expect(users.find((u) => u.id === 11)).toBeUndefined();
  });

  // -- 11) /options caps each type at 50 (Phase 4 DoD pagination/cap) --------
  // Tenant 1 has 146 active users → server-side LIMIT 50 must clamp.
  it('GET /kvp/participants/options caps users at 50', async () => {
    const res = await fetch(`${BASE_URL}/kvp/participants/options?q=`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const users = body.data.users as Array<unknown>;
    expect(users.length).toBeLessThanOrEqual(50);
    // Hard assertion: 146 active users in seeded apitest tenant means the
    // cap is actually exercised. If this assertion ever fails, either the
    // user fixture shrank below 50 or the LIMIT was lowered in the service.
    expect(users.length).toBe(50);
  });

  // -- 8) Addon disabled → 403 on participant + create endpoints -------------
  describe('addon disabled', () => {
    let needsRestore = false;

    beforeAll(async () => {
      const r = await fetch(`${BASE_URL}/addons/deactivate`, {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({ tenantId: auth.tenantId, addonCode: 'kvp' }),
      });
      // 200 Created/OK = success. NotFound (404) = already off; both leave
      // us in a state that needs restore to active.
      if (r.status === 200 || r.status === 201 || r.status === 404) {
        needsRestore = true;
      }
    });

    afterAll(async () => {
      if (!needsRestore) return;
      await fetch(`${BASE_URL}/addons/activate`, {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({ tenantId: auth.tenantId, addonCode: 'kvp' }),
      });
    });

    it('GET /kvp/participants/options returns 403 with addon disabled', async () => {
      const res = await fetch(`${BASE_URL}/kvp/participants/options`, {
        headers: authOnly(auth.authToken),
      });
      expect(res.status).toBe(403);
    });

    it('POST /kvp returns 403 with addon disabled', async () => {
      const res = await fetch(`${BASE_URL}/kvp`, {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({
          title: 'should-fail',
          description: 'Phase 4 P8 — addon-disabled rejection.',
          categoryId: 1,
          priority: 'normal',
        }),
      });
      expect(res.status).toBe(403);
    });
  });
});
