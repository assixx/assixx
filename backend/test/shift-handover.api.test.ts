/**
 * Shift Handover API Integration Tests (Phase 4 of FEAT_SHIFT_HANDOVER_MASTERPLAN.md).
 *
 * Tier-2 tests per ADR-018 — exercises the live HTTP stack against a real
 * Postgres + Redis Docker backend (not mocked). Asserts the contract
 * documented in plan §2.6 (controller endpoints) and the permission /
 * tenant-isolation rules from ADR-019, ADR-020, ADR-033, ADR-045.
 *
 * Setup discipline (beforeAll):
 *   1. Login as apitest root (cached helper).
 *   2. Create two independent teams via the public API: one for template
 *      CRUD (incl. soft-delete), one for the entry lifecycle. Decoupling
 *      avoids the delete-template test hollowing out the team that the
 *      entries lifecycle depends on for `schema_snapshot` validation.
 *   3. Compute "today_berlin" via a single SQL probe so the shift seed
 *      and the API request payloads agree on the same DATE value as the
 *      resolver (`(now() AT TIME ZONE 'Europe/Berlin')::date`).
 *   4. Seed `shifts` rows for the apitest root user on the entry team
 *      for all three slots. The resolver (`canWriteForShift`) requires
 *      assignee membership in `shifts` ∪ `shift_rotation_history` —
 *      there is no canManage bypass at the EntriesService layer (plan
 *      §2.5). Microsecond offset on `start_time` keeps the unique index
 *      `(user_id, date, start_time)` happy across test reruns.
 *   5. Provision the test employee + login → token used to assert the
 *      403 path for users without `user_addon_permissions` grants
 *      (ADR-020 fail-closed).
 *
 * Coverage map vs plan §Phase 4 mandatory scenarios + DoD:
 *   - Auth & addon gate: §1 (401 unauthenticated). Addon gating is
 *     transitively verified — the `shift_planning` addon is active for
 *     tenant 1 and every test passes through `TenantAddonGuard`; a
 *     "tenant without addon" assertion would require a separate tenant
 *     seed outside this file's scope (see §Spec Deviation note below).
 *   - Template CRUD (Plan §2.6 rows 1-3): §2.
 *   - Entry lifecycle + state machine (rows 4-9): §3.
 *   - List + pagination (DoD line "pagination verified"): §4.
 *   - Attachments (rows 10-12): §5.
 *   - RLS / tenant isolation: §6.
 *   - Permission matrix (ADR-045 Layer-2 fail-closed for non-grantees): §7.
 *
 * Spec Deviation #4 (recorded in §Spec Deviations): the "tenant without
 * `shift_planning` addon → 403" scenario is not asserted here because
 * the only ergonomic way to verify it is to (a) hold credentials for a
 * second tenant whose addon row has `status='cancelled'` (none of the
 * 9 dev tenants currently fits — all have `active` or active-`trial`),
 * or (b) toggle the addon row mid-suite which would race with parallel
 * tests in the `api` project. The contract is enforced by the
 * class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` decorator + the
 * global `TenantAddonGuard`, both verified at the unit-test layer.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 4
 * @see docs/infrastructure/adr/ADR-018-testing-strategy.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
import { execSync } from 'node:child_process';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  createDepartmentAndTeam,
  ensureTestEmployee,
  loginApitest,
  loginNonRoot,
} from './helpers.js';

let auth: AuthState;
let employeeToken: string;

let templateTeamId: number;
let entryTeamId: number;
let entryDepartmentId: number;
let todayBerlin: string; // YYYY-MM-DD per Europe/Berlin

let entryId: string; // first draft on `early` slot, used by lifecycle tests
let attachmentEntryId: string; // separate draft on `late` slot, used by attachments
let attachmentId: string;

/**
 * Run a single SQL statement against the running Postgres container as
 * `assixx_user` (BYPASSRLS) and return the trimmed stdout. We use this
 * for two narrowly-scoped purposes:
 *   1. Probe `today_berlin` so the test agrees with the resolver's
 *      Europe/Berlin TZ math without re-implementing it in Node.
 *   2. Seed `shifts` rows + a cross-tenant fixture for the RLS test —
 *      operations the public API does not (yet) expose at the precise
 *      shape we need (e.g. specific `start_time` for unique-index
 *      avoidance, cross-tenant insert).
 *
 * Avoid widening the use of this helper — every direct DB write is a
 * leak in test-API surface coverage.
 */
function sqlProbe(query: string): string {
  return execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "${query.replace(/"/g, '\\"')}"`,
  )
    .toString()
    .trim();
}

beforeAll(async () => {
  auth = await loginApitest();

  todayBerlin = sqlProbe("SELECT (now() AT TIME ZONE 'Europe/Berlin')::date;");

  const t1 = await createDepartmentAndTeam(auth.authToken);
  templateTeamId = t1.teamId;

  const t2 = await createDepartmentAndTeam(auth.authToken);
  entryTeamId = t2.teamId;
  entryDepartmentId = t2.departmentId;

  // Seed shift_times for the canonical 3 slots (ADR-052 §Decision 1 / R13).
  // `ActiveShiftResolverService.checkWriteWindow()` JOINs `shift_times` to
  // compute the per-slot write-window. Without rows here, every entry-write
  // attempt short-circuits to `{reason: 'shift_times_missing'}` and the
  // controller maps that to 400 BEFORE the assignee check runs — masking the
  // actual permission/state path we're testing. `shift_times` is intentionally
  // NOT in `global-teardown.ts` `TRANSIENT_TABLES`, so a single inline seed
  // here persists across runs; `ON CONFLICT` keeps it idempotent. Times use
  // the canonical 3-shift wall-clock pattern (Frühschicht 06-14, Spätschicht
  // 14-22, Nachtschicht 22-06).
  sqlProbe(
    `INSERT INTO shift_times (tenant_id, shift_key, label, start_time, end_time, sort_order, is_active) VALUES ` +
      `(${auth.tenantId}, 'early', 'Frühschicht', '06:00', '14:00', 1, 1),` +
      `(${auth.tenantId}, 'late',  'Spätschicht', '14:00', '22:00', 2, 1),` +
      `(${auth.tenantId}, 'night', 'Nachtschicht', '22:00', '06:00', 3, 1)` +
      ` ON CONFLICT (tenant_id, shift_key) WHERE is_active <> 4 DO NOTHING;`,
  );

  // Seed one shift per slot for the apitest root user.
  // start_time gets a (teamId * 1µs) offset so the unique index
  // `(user_id, date, start_time)` does not collide across test reruns
  // that hit the same Berlin date with a different team_id.
  // resolver only matches on (tenant_id, team_id, date, type, user_id)
  // so the exact start_time value is irrelevant to the assertion.
  sqlProbe(
    `INSERT INTO shifts (tenant_id, user_id, team_id, department_id, date, type, start_time, status, created_by) VALUES ` +
      `(${auth.tenantId}, ${auth.userId}, ${entryTeamId}, ${entryDepartmentId}, '${todayBerlin}'::date, 'early', ('${todayBerlin}'::date + interval '4 hours' + ${entryTeamId} * interval '1 microsecond')::timestamptz, 'planned', ${auth.userId}),` +
      `(${auth.tenantId}, ${auth.userId}, ${entryTeamId}, ${entryDepartmentId}, '${todayBerlin}'::date, 'late',  ('${todayBerlin}'::date + interval '12 hours' + ${entryTeamId} * interval '1 microsecond')::timestamptz, 'planned', ${auth.userId}),` +
      `(${auth.tenantId}, ${auth.userId}, ${entryTeamId}, ${entryDepartmentId}, '${todayBerlin}'::date, 'night', ('${todayBerlin}'::date + interval '20 hours' + ${entryTeamId} * interval '1 microsecond')::timestamptz, 'planned', ${auth.userId})` +
      ` ON CONFLICT (user_id, date, start_time) DO NOTHING;`,
  );

  await ensureTestEmployee(auth.authToken);
  // Full 2-step 2FA dance per FEAT_2FA_EMAIL Step 2.4 — `loginNonRoot`
  // consolidates the login → Mailpit → verify flow across api-test files.
  employeeToken = await loginNonRoot('employee@assixx.com', APITEST_PASSWORD);
});

// ─── 1. Auth gate + my-permissions ─────────────────────────────────────────

describe('Shift Handover: Auth & my-permissions', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`);
    expect(res.status).toBe(401);
  });

  it('returns root full-access shape on /my-permissions', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/my-permissions`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.templates).toEqual({ canRead: true, canWrite: true, canDelete: true });
    expect(body.data.entries).toEqual({ canRead: true, canWrite: true, canDelete: true });
  });
});

// ─── 2. Templates CRUD ─────────────────────────────────────────────────────

describe('Shift Handover: Templates CRUD', () => {
  const validFields = [
    {
      key: 'mood',
      label: 'Stimmung',
      type: 'select' as const,
      required: false,
      options: [
        { value: 'good', label: 'Gut' },
        { value: 'neutral', label: 'Neutral' },
      ],
    },
    { key: 'incidents', label: 'Vorfälle', type: 'textarea' as const, required: false },
  ];

  it('GET on a fresh team returns the default-empty {team_id, fields:[]}', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.team_id).toBe(templateTeamId);
    expect(body.data.fields).toEqual([]);
  });

  it('PUT with valid fields → 200, returns persisted row', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ fields: validFields }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.team_id).toBe(templateTeamId);
    expect(body.data.fields).toHaveLength(2);
  });

  it('PUT idempotent — second call with same payload returns same row id', async () => {
    const first = (await (
      await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
        headers: authOnly(auth.authToken),
      })
    ).json()) as JsonBody;
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ fields: validFields }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(first.data.id);
  });

  it('PUT rejects duplicate field keys with 400', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fields: [
          { key: 'dup', label: 'A', type: 'text' },
          { key: 'dup', label: 'B', type: 'text' },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT rejects an invalid field key (uppercase) with 400', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fields: [{ key: 'MoodA', label: 'Mood', type: 'text' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT rejects a select field without options with 400', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fields: [{ key: 'mood', label: 'Mood', type: 'select' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT rejects > 30 fields with 400', async () => {
    const fields = Array.from({ length: 31 }, (_, i) => ({
      key: `f${i}`,
      label: `Field ${i}`,
      type: 'text' as const,
    }));
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ fields }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT accepts all 8 field types in one template', async () => {
    const allTypes = [
      { key: 'a_text', label: 'Text', type: 'text' as const },
      { key: 'a_textarea', label: 'Textarea', type: 'textarea' as const },
      { key: 'a_integer', label: 'Integer', type: 'integer' as const },
      { key: 'a_decimal', label: 'Decimal', type: 'decimal' as const },
      { key: 'a_date', label: 'Date', type: 'date' as const },
      { key: 'a_time', label: 'Time', type: 'time' as const },
      { key: 'a_boolean', label: 'Boolean', type: 'boolean' as const },
      {
        key: 'a_select',
        label: 'Select',
        type: 'select' as const,
        options: [{ value: 'x', label: 'X' }],
      },
    ];
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ fields: allTypes }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.fields).toHaveLength(8);
  });

  it('DELETE template → 204 (NO_CONTENT, soft-delete)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(204);
  });

  it('DELETE template again → 404 (already inactive, no row to soft-delete)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${templateTeamId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(404);
  });
});

// ─── 3. Entries lifecycle ──────────────────────────────────────────────────

describe('Shift Handover: Entries lifecycle (draft → submit → reopen → submit)', () => {
  beforeAll(async () => {
    // Seed a template on entryTeam so the submit-time `custom_values`
    // re-validation has fields to validate against.
    await fetch(`${BASE_URL}/shift-handover/templates/${entryTeamId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        fields: [
          { key: 'incident_count', label: 'Incidents', type: 'integer', required: false },
          { key: 'notes', label: 'Notizen', type: 'textarea', required: false },
        ],
      }),
    });
  });

  it('POST entry as assignee → 201 with status=draft', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        teamId: entryTeamId,
        shiftDate: todayBerlin,
        shiftKey: 'early',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.status).toBe('draft');
    expect(body.data.team_id).toBe(entryTeamId);
    expect(body.data.shift_key).toBe('early');
    entryId = body.data.id as string;
  });

  it('POST same triple again → returns the existing draft (idempotent, same id)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        teamId: entryTeamId,
        shiftDate: todayBerlin,
        shiftKey: 'early',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(entryId);
  });

  it('GET entry by id → 200', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(entryId);
  });

  it('PATCH draft with protocolText + matching customValues → 200', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        protocolText: 'Schicht ohne Vorkommnisse.',
        customValues: { incident_count: 0, notes: 'Alles ruhig.' },
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.protocol_text).toBe('Schicht ohne Vorkommnisse.');
    expect(body.data.custom_values).toEqual({ incident_count: 0, notes: 'Alles ruhig.' });
  });

  it('PATCH with type-mismatched customValues (string for integer field) → 400', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        customValues: { incident_count: 'not-a-number' },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST submit → 200, status=submitted, schema_snapshot frozen', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}/submit`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('submitted');
    // R2: snapshot of the live template at submit-time
    expect(Array.isArray(body.data.schema_snapshot)).toBe(true);
    expect(body.data.schema_snapshot.length).toBeGreaterThanOrEqual(2);
    expect(body.data.submitted_by).toBe(auth.userId);
  });

  it('PATCH submitted entry → 400 ("Entry is locked")', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ protocolText: 'Trying to edit after submit' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST submit again → 400 ("already submitted")', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}/submit`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST reopen with reason → 200, status=reopened, reason persisted', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}/reopen`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ reason: 'Korrektur erforderlich (test)' }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('reopened');
    expect(body.data.reopen_reason).toBe('Korrektur erforderlich (test)');
    expect(body.data.reopened_by).toBe(auth.userId);
  });

  it('POST reopen with empty reason → 400 (Zod min(1))', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}/reopen`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ reason: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST submit after reopen → 200, status returns to submitted', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${entryId}/submit`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('submitted');
  });

  it('GET non-existent entry → 404', async () => {
    // Structurally-valid UUIDv7 (version-nibble=7, variant=10xx) that
    // cannot exist as a freshly-minted row.
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries/00000000-0000-7000-8000-000000000000`,
      { headers: authOnly(auth.authToken) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── 4. List + pagination ──────────────────────────────────────────────────

describe('Shift Handover: List entries + pagination', () => {
  it('GET /entries without teamId → 400 (Plan Spec Deviation #3 — V1 same-team scope)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries`, {
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(400);
  });

  it('GET /entries?teamId=X → 200 with envelope {items,total,page,limit}', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries?teamId=${entryTeamId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('page');
    expect(body.data).toHaveProperty('limit');
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /entries with page=1&limit=5 → respects pagination params', async () => {
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries?teamId=${entryTeamId}&page=1&limit=5`,
      { headers: authOnly(auth.authToken) },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(5);
    expect(body.data.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /entries with status=submitted → filtered list, all items submitted', async () => {
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries?teamId=${entryTeamId}&status=submitted`,
      { headers: authOnly(auth.authToken) },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    for (const item of body.data.items as JsonBody[]) {
      expect(item.status).toBe('submitted');
    }
  });
});

// ─── 5. Attachments ────────────────────────────────────────────────────────

describe('Shift Handover: Attachments', () => {
  /** Minimal valid 1×1 PNG (68 bytes), reused across tests. */
  function createTestPng(name: string): File {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    );
    return new File([png], name, { type: 'image/png' });
  }

  beforeAll(async () => {
    // Use the `late` slot so we leave the `early`-slot draft from the
    // entries lifecycle suite (now in `submitted` state) undisturbed.
    const res = await fetch(`${BASE_URL}/shift-handover/entries`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        teamId: entryTeamId,
        shiftDate: todayBerlin,
        shiftKey: 'late',
      }),
    });
    const body = (await res.json()) as JsonBody;
    attachmentEntryId = body.data.id as string;
  });

  it('POST attachment with a valid PNG → 201', async () => {
    const form = new FormData();
    form.append('file', createTestPng('shift-test-1.png'));
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: form,
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.data.entry_id).toBe(attachmentEntryId);
    expect(body.data.mime_type).toBe('image/png');
    attachmentId = body.data.id as string;
  });

  it('GET stream attachment → 200 binary, Content-Type image/png', async () => {
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments/${attachmentId}`,
      { headers: authOnly(auth.authToken) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('POST with non-image MIME (text/plain) → 400 (service whitelist)', async () => {
    const form = new FormData();
    form.append('file', new File(['hello'], 'evil.txt', { type: 'text/plain' }));
    const res = await fetch(`${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('6th attachment (5-cap) → 400, prior 4 succeed', async () => {
    // We already uploaded 1 → upload 4 more (total 5) → 6th must fail.
    for (let i = 2; i <= 5; i++) {
      const form = new FormData();
      form.append('file', createTestPng(`shift-test-${i}.png`));
      const res = await fetch(
        `${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.authToken}` },
          body: form,
        },
      );
      expect(res.status).toBe(201);
    }
    const form = new FormData();
    form.append('file', createTestPng('shift-test-6.png'));
    const overflow = await fetch(
      `${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.authToken}` },
        body: form,
      },
    );
    expect(overflow.status).toBe(400);
  });

  it('DELETE attachment → 204', async () => {
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
        headers: authOnly(auth.authToken),
      },
    );
    expect(res.status).toBe(204);
  });

  it('GET stream after delete → 404', async () => {
    const res = await fetch(
      `${BASE_URL}/shift-handover/entries/${attachmentEntryId}/attachments/${attachmentId}`,
      { headers: authOnly(auth.authToken) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── 6. Tenant isolation (RLS strict-mode, ADR-019) ────────────────────────

describe('Shift Handover: Tenant isolation (RLS)', () => {
  it('cross-tenant template insert is invisible to tenant 1 GET', async () => {
    // Ensure firma-a (tenant 2) has at least one team for the cross-tenant
    // RLS probe. Pre-2026-04 this relied on the deleted `testfirma` (tenant 8)
    // seed; the dev-tenant migration to assixx/firma-a/firma-b/scs/unverified-e2e
    // (FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN §0.7 + database/seeds/002)
    // left no non-1 tenant with `teams` rows, breaking the original probe.
    // Idempotent NOT-EXISTS guards keep reruns from accumulating duplicates;
    // `team_lead_id` is NULL so the `validate_team_lead_position` trigger is
    // bypassed without needing a known fixture user in tenant 2.
    sqlProbe(
      `INSERT INTO departments (tenant_id, name, description, is_active, uuid, uuid_created_at) ` +
        `SELECT 2, 'RLS Test Department', 'Auto-created for shift-handover RLS test', 1, gen_random_uuid()::char(36), NOW() ` +
        `WHERE NOT EXISTS (SELECT 1 FROM departments WHERE tenant_id = 2 AND name = 'RLS Test Department');`,
    );
    sqlProbe(
      `INSERT INTO teams (tenant_id, name, department_id, is_active, uuid, uuid_created_at) ` +
        `SELECT 2, 'RLS Test Team', (SELECT id FROM departments WHERE tenant_id = 2 AND name = 'RLS Test Department' LIMIT 1), 1, gen_random_uuid()::char(36), NOW() ` +
        `WHERE NOT EXISTS (SELECT 1 FROM teams WHERE tenant_id = 2 AND name = 'RLS Test Team');`,
    );

    // Pick a real team in another tenant (FK on shift_handover_templates.team_id
    // would reject a synthetic id). Strict-mode RLS policy on
    // shift_handover_templates filters by `app.tenant_id` — so the controller's
    // getTemplateForTeam (running with tenant_id=1 from JWT) cannot see the
    // foreign-tenant row and the controller synthesises the default-empty shape.
    const otherTenantRow = sqlProbe(
      "SELECT tenant_id || ',' || id FROM teams WHERE tenant_id <> 1 ORDER BY tenant_id, id LIMIT 1;",
    );
    if (otherTenantRow === '') {
      throw new Error('No team in any non-1 tenant — cannot run RLS isolation test');
    }
    const [otherTenantStr, otherTeamStr] = otherTenantRow.split(',');
    const otherTenant = Number(otherTenantStr);
    const otherTeam = Number(otherTeamStr);
    sqlProbe(
      `INSERT INTO shift_handover_templates (tenant_id, team_id, fields, created_by, updated_by) ` +
        `VALUES (${otherTenant}, ${otherTeam}, '[]'::jsonb, NULL, NULL) ` +
        `ON CONFLICT (tenant_id, team_id) DO NOTHING;`,
    );

    const res = await fetch(`${BASE_URL}/shift-handover/templates/${otherTeam}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.fields).toEqual([]);
    expect(body.data.team_id).toBe(otherTeam);
  });
});

// ─── 7. Permission matrix — Employee without grants (ADR-020 fail-closed) ─

describe('Shift Handover: Permission matrix (Employee without grants)', () => {
  it('Employee /my-permissions returns the all-false default shape', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/my-permissions`, {
      headers: authOnly(employeeToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.templates).toEqual({ canRead: false, canWrite: false, canDelete: false });
    expect(body.data.entries).toEqual({ canRead: false, canWrite: false, canDelete: false });
  });

  it('Employee GET template → 403 (no canRead grant on shift-handover-templates)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${entryTeamId}`, {
      headers: authOnly(employeeToken),
    });
    expect(res.status).toBe(403);
  });

  it('Employee POST entry → 403 (no canWrite grant on shift-handover-entries)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/entries`, {
      method: 'POST',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({
        teamId: entryTeamId,
        shiftDate: todayBerlin,
        shiftKey: 'early',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('Employee PUT template → 403 (Layer-2 fails fast before Layer-1 canManage runs)', async () => {
    const res = await fetch(`${BASE_URL}/shift-handover/templates/${entryTeamId}`, {
      method: 'PUT',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({ fields: [] }),
    });
    expect(res.status).toBe(403);
  });
});
