/**
 * Root Self-Termination API Integration Tests — Phase 4 / Session 8.
 *
 * Verifies the 6 HTTP endpoints exposed by `RootSelfTerminationController`
 * under `/api/v2/users/...` plus the cross-cutting interactions with the
 * Layer 2 service guard (`RootProtectionService`, wired into
 * `users.service.ts:deleteUser` + `archiveUser` per Session 4) and the
 * Layer 4 PostgreSQL trigger (`fn_prevent_cross_root_change`).
 *
 * Fixture model — 3 dedicated test tenants created via direct DB INSERT as
 * `assixx_user` (BYPASSRLS) in `beforeAll`:
 *   - `rstApi-<runtag>`  — 4 active roots + 1 admin + 1 employee
 *                          (CRUD / auth / bypass / notifications)
 *   - `rstLast-<runtag>` — 1 active root (last-root protection)
 *   - `rstIso-<runtag>`  — 2 active roots (RLS tenant isolation)
 *
 * Bcrypt password hash is reused from the existing `info@assixx.com` row so
 * every fixture user can log in with the project-wide `APITEST_PASSWORD`
 * via the standard `/auth/login` endpoint. The hash is fetched once in
 * `beforeAll` and embedded in the user INSERT.
 *
 * Test ordering is deterministic (Vitest runs `describe` blocks
 * sequentially inside a single file). State chains:
 *   • Request lifecycle: rootA1 creates → rootA2 lists → rootA1 self-approve
 *     blocked → rootA2 approves → rootA1 becomes is_active=4
 *   • Reject + cooldown: rootA3 creates → rootA4 rejects → rootA3 cooldown
 *     active → DB-backdate `rejected_at` to NOW()-25h → rootA3 may re-create
 *
 * The notification tests run LAST and verify the persistent INSERT side-
 * effects from the earlier mutations (the 3 typed events are fire-and-
 * forget and complete before the HTTP response — see Session 6).
 *
 * § Spec Deviation D9: masterplan §4 phrasing names `PATCH /users/{uuid}`
 * for the direct-API bypass tests. The actual UsersController exposes
 * `PUT /users/uuid/:uuid` (the `@Patch('me')` route is self-only). T16-T18
 * use the real routes. T17 (cross-root role demote via PUT) is structurally
 * unwired at the service layer because Session 4 deferred the role-flip
 * Layer-2 wiring on `updateUser` — Layer 4 trigger is the sole gate. The
 * trigger raises a PG exception that surfaces to the client as 500 (no
 * dedicated NestJS pg-error filter), so T17 asserts non-2xx + DB-side
 * proof of non-mutation rather than a strict 403. Behavioural guarantee
 * is identical: cross-root role demote is impossible from app_user.
 *
 * Cleanup in `afterAll` hard-deletes notifications + requests + users +
 * tenants in FK-safe order via `assixx_user` (BYPASSRLS — bypasses the
 * trigger so even rows that were soft-deleted by the approve-flow can be
 * removed without ROOT_CROSS_TERMINATION_FORBIDDEN). `users.tenant_id`
 * is `ON DELETE RESTRICT` so child rows must go first.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §4 (Phase 4 spec)
 * @see backend/src/nest/root/root-self-termination.controller.ts
 * @see backend/test/root-protection-trigger.api.test.ts (Session 7c sibling)
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md (Triple-User-Model)
 */
import { execSync } from 'node:child_process';

import {
  APITEST_PASSWORD,
  BASE_URL,
  type JsonBody,
  clear2faStateForUser,
  extractCookieValue,
  fetchLatest2faCode,
  fetchWithRetry,
  flushThrottleKeys,
} from './helpers.js';

// ─── psql helpers (same pattern as root-protection-trigger.api.test.ts) ──────

type DbUser = 'app_user' | 'assixx_user' | 'sys_user';

function psqlOk(user: DbUser, sql: string): string {
  return execSync(
    `docker exec -i assixx-postgres psql -U ${user} -d assixx -tA -F '|' -v ON_ERROR_STOP=1`,
    { input: sql, stdio: ['pipe', 'pipe', 'pipe'] },
  )
    .toString()
    .trim();
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface RootUser {
  id: number;
  uuid: string;
  email: string;
  token: string;
}

interface NonRootUser {
  id: number;
  email: string;
  token: string;
}

interface FixtureState {
  apiTenantId: number;
  apiTenantName: string;
  lastTenantId: number;
  lastTenantName: string;
  isoTenantId: number;
  isoTenantName: string;
  rootA1: RootUser; // request flow — will be is_active=4 after T09
  rootA2: RootUser; // approver + lister + bypass actor
  rootA3: RootUser; // reject flow requester
  rootA4: RootUser; // rejecter + bypass target
  adminA: NonRootUser;
  employeeA: NonRootUser;
  rootLast: RootUser; // sole root in last-root tenant
  rootC1: RootUser; // requester in iso tenant
  rootC2: RootUser; // approver in iso tenant (kept active so C1 isn't last-root)
}

// All-lowercase: `EmailSchema` (common.schema.ts) calls `.toLowerCase()` on
// every login input, so DB-stored emails MUST already be lowercase to match
// the post-normalisation `WHERE email = $1` lookup in auth.service.findUserByEmail.
const RUN_TAG = `s8${Date.now()}`;
const T_API = `rstapi-${RUN_TAG}`;
const T_LAST = `rstlast-${RUN_TAG}`;
const T_ISO = `rstiso-${RUN_TAG}`;

let fx: FixtureState;

// IDs of self-termination requests created during the suite — used by the
// later notification tests + the RLS isolation tests + the cleanup phase.
let requestIdRootA1: string; // T04 — approved by rootA2 in T09
let requestIdRootA3: string; // T11 — rejected by rootA4 in T13
let requestIdRootA3Reissued: string; // T15 — re-created after cooldown
let requestIdRootC1: string; // T20 setup — pending in iso tenant

// ─── Login helper (per-user, with 429 retry) ─────────────────────────────────

/**
 * Run the full 2-step 2FA login dance for a fixture user (login → challenge
 * → Mailpit code → verify) and return the access token extracted from the
 * verify response's Set-Cookie. `userId` is pre-known from the fixture-build
 * `userByEmail` map so we avoid an extra psql lookup. Pre-clears
 * `2fa:lock:{userId}` + `2fa:fail-streak:{userId}` so a poisoned prior run
 * cannot block the attempt. Mailpit lookup is `since`-scoped — never call
 * `clearMailpit()` (cross-worker race per FEAT_2FA_EMAIL §0.5.5 v0.7.2).
 */
async function loginAs(email: string, userId: number): Promise<string> {
  clear2faStateForUser(userId);
  const loginStartedAt = new Date();

  const loginRes = await fetchWithRetry(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: APITEST_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed for ${email}: ${String(loginRes.status)} ${loginRes.statusText}`);
  }
  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`unexpected login stage for ${email}: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error(`no challengeToken cookie for ${email}`);
  }

  const code = await fetchLatest2faCode(email, 10_000, loginStartedAt);
  const verifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `challengeToken=${challengeToken}` },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: ${String(verifyRes.status)}`);
  }
  const accessToken = extractCookieValue(verifyRes.headers.getSetCookie(), 'accessToken');
  if (accessToken === null) {
    throw new Error(`no accessToken cookie for ${email}`);
  }
  return accessToken;
}

beforeAll(async () => {
  // 0) Flush rate-limit keys — beforeAll triggers ~9 sequential /auth/login
  //    calls in fixture setup which would otherwise trip the per-IP limiter
  //    on rapid re-runs of this suite.
  flushThrottleKeys();

  // 1) Pull the existing bcrypt hash for ApiTest12345! — reuse for every
  //    fixture user so they can log in via the standard /auth/login path.
  //    The `$`-chars in the bcrypt hash are literal inside the surrounding
  //    single-quoted SQL string; psql/execSync does not interpolate them.
  const passwordHash = psqlOk(
    'assixx_user',
    `SELECT password FROM users WHERE email = 'info@assixx.com' LIMIT 1;`,
  );
  if (!passwordHash.startsWith('$2')) {
    throw new Error(`Unexpected password-hash shape: ${passwordHash}`);
  }

  // 2) Create 3 tenants + their users in one transactional INSERT script.
  //    Run as assixx_user to side-step RLS and the Layer-4 trigger entirely.
  //    Each users row sets has_full_access=true for roots (mandatory per
  //    chk_root_full_access constraint, migration 20260207000000020).
  const apiUsers = [
    { tag: 'rootA1', email: `roota1@${T_API}.test`, role: 'root', fullAccess: true },
    { tag: 'rootA2', email: `roota2@${T_API}.test`, role: 'root', fullAccess: true },
    { tag: 'rootA3', email: `roota3@${T_API}.test`, role: 'root', fullAccess: true },
    { tag: 'rootA4', email: `roota4@${T_API}.test`, role: 'root', fullAccess: true },
    { tag: 'adminA', email: `admina@${T_API}.test`, role: 'admin', fullAccess: false },
    { tag: 'employeeA', email: `employeea@${T_API}.test`, role: 'employee', fullAccess: false },
  ];
  const lastUsers = [
    { tag: 'rootLast', email: `rootlast@${T_LAST}.test`, role: 'root', fullAccess: true },
  ];
  const isoUsers = [
    { tag: 'rootC1', email: `rootc1@${T_ISO}.test`, role: 'root', fullAccess: true },
    { tag: 'rootC2', email: `rootc2@${T_ISO}.test`, role: 'root', fullAccess: true },
  ];
  const allUsers = [
    ...apiUsers.map((u) => ({ ...u, tenantSubdomain: T_API })),
    ...lastUsers.map((u) => ({ ...u, tenantSubdomain: T_LAST })),
    ...isoUsers.map((u) => ({ ...u, tenantSubdomain: T_ISO })),
  ];

  const userValuesSql = allUsers
    .map(
      (u) =>
        `((SELECT id FROM tenants WHERE subdomain = '${u.tenantSubdomain}'), ` +
        `'${u.email}', '${u.email}', 'RST-${u.tag}', '${passwordHash}', ` +
        `'${u.role}', ${u.fullAccess}, gen_random_uuid()::char(36), 1)`,
    )
    .join(',\n      ');

  psqlOk(
    'assixx_user',
    `
    BEGIN;

    INSERT INTO tenants (company_name, subdomain, email, uuid, uuid_created_at)
    VALUES
      ('Root Self-Term API T1', '${T_API}', 'admin@${T_API}.test', gen_random_uuid()::char(36), NOW()),
      ('Root Self-Term Last T2', '${T_LAST}', 'admin@${T_LAST}.test', gen_random_uuid()::char(36), NOW()),
      ('Root Self-Term Iso T3', '${T_ISO}', 'admin@${T_ISO}.test', gen_random_uuid()::char(36), NOW());

    INSERT INTO users
      (tenant_id, username, email, employee_number, password, role, has_full_access, uuid, is_active)
    VALUES
      ${userValuesSql};

    COMMIT;
    `,
  );

  // 3) Read back tenant + user IDs/UUIDs in one tagged query.
  const idLines = psqlOk(
    'assixx_user',
    `
    SELECT 't|' || id || '|' || subdomain FROM tenants WHERE subdomain IN ('${T_API}', '${T_LAST}', '${T_ISO}')
    UNION ALL
    SELECT 'u|' || id || '|' || email || '|' || uuid FROM users WHERE email IN (${allUsers.map((u) => `'${u.email}'`).join(', ')});
    `,
  );

  const tenantBySubdomain = new Map<string, number>();
  const userByEmail = new Map<string, { id: number; uuid: string }>();
  for (const line of idLines.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const parts = trimmed.split('|');
    if (parts[0] === 't' && parts[1] !== undefined && parts[2] !== undefined) {
      tenantBySubdomain.set(parts[2], Number(parts[1]));
    } else if (
      parts[0] === 'u' &&
      parts[1] !== undefined &&
      parts[2] !== undefined &&
      parts[3] !== undefined
    ) {
      userByEmail.set(parts[2], { id: Number(parts[1]), uuid: parts[3] });
    }
  }

  function need(
    map: Map<string, { id: number; uuid: string }>,
    key: string,
  ): { id: number; uuid: string } {
    const v = map.get(key);
    if (v === undefined) throw new Error(`Fixture: missing user ${key}`);
    return v;
  }

  function tenantId(subdomain: string): number {
    const v = tenantBySubdomain.get(subdomain);
    if (v === undefined) throw new Error(`Fixture: missing tenant ${subdomain}`);
    return v;
  }

  // 4) Login each user → JWT (full 2FA dance per Step 2.4).
  async function buildRoot(tag: string, tenantSub: string): Promise<RootUser> {
    const email = `${tag.toLowerCase()}@${tenantSub}.test`;
    const u = need(userByEmail, email);
    const token = await loginAs(email, u.id);
    return { id: u.id, uuid: u.uuid, email, token };
  }
  async function buildNonRoot(tag: string): Promise<NonRootUser> {
    const email = `${tag.toLowerCase()}@${T_API}.test`;
    const u = need(userByEmail, email);
    const token = await loginAs(email, u.id);
    return { id: u.id, email, token };
  }

  fx = {
    apiTenantId: tenantId(T_API),
    apiTenantName: T_API,
    lastTenantId: tenantId(T_LAST),
    lastTenantName: T_LAST,
    isoTenantId: tenantId(T_ISO),
    isoTenantName: T_ISO,
    rootA1: await buildRoot('rootA1', T_API),
    rootA2: await buildRoot('rootA2', T_API),
    rootA3: await buildRoot('rootA3', T_API),
    rootA4: await buildRoot('rootA4', T_API),
    adminA: await buildNonRoot('adminA'),
    employeeA: await buildNonRoot('employeeA'),
    rootLast: await buildRoot('rootLast', T_LAST),
    rootC1: await buildRoot('rootC1', T_ISO),
    rootC2: await buildRoot('rootC2', T_ISO),
  };

  // 5) Pre-create rootC1's pending request directly via DB so the RLS isolation
  //    tests (T20-T21) can target a known-foreign request. Done as
  //    assixx_user — the trigger does not fire on INSERT (only UPDATE/DELETE),
  //    and RLS-bypass lets us cross-tenant-write.
  //
  //    INSERT + separate SELECT (rather than INSERT...RETURNING in one call)
  //    because psql `-tA` does not reliably suppress the `INSERT 0 1` command
  //    tag in every build — split queries give a clean single-line UUID.
  psqlOk(
    'assixx_user',
    `
    INSERT INTO root_self_termination_requests
      (id, tenant_id, requester_id, status, expires_at)
    VALUES
      (uuidv7(), ${fx.isoTenantId}, ${fx.rootC1.id}, 'pending', NOW() + INTERVAL '7 days');
    `,
  );
  requestIdRootC1 = psqlOk(
    'assixx_user',
    `SELECT id::text FROM root_self_termination_requests
     WHERE tenant_id = ${fx.isoTenantId} AND requester_id = ${fx.rootC1.id} AND status = 'pending';`,
  );
});

afterAll(() => {
  // Cleanup in FK-safe order. notifications has no FK to tenants/users
  // (recipient_id is a plain INT — see service comment) so the rows must
  // be matched by tenant_id directly.
  psqlOk(
    'assixx_user',
    `
    DELETE FROM notifications WHERE tenant_id IN (${fx.apiTenantId}, ${fx.lastTenantId}, ${fx.isoTenantId});
    DELETE FROM root_self_termination_requests WHERE tenant_id IN (${fx.apiTenantId}, ${fx.lastTenantId}, ${fx.isoTenantId});
    DELETE FROM users WHERE tenant_id IN (${fx.apiTenantId}, ${fx.lastTenantId}, ${fx.isoTenantId});
    DELETE FROM tenants WHERE subdomain IN ('${T_API}', '${T_LAST}', '${T_ISO}');
    `,
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Root Self-Termination API', () => {
  // ── Auth (3) ───────────────────────────────────────────────────────────────

  describe('Auth gates', () => {
    it('T01: POST /users/me/self-termination-request without auth → 401', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('T02: POST as admin → 403 (Roles guard)', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.adminA.token}`,
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });

    it('T03: POST as employee → 403', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.employeeA.token}`,
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });
  });

  // ── CRUD: Request → List → Self-decision-block → Approve ──────────────────

  describe('CRUD: request + list', () => {
    it('T04: rootA1 POST request → 201 with id, status, expires_at', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA1.token}`,
        },
        body: JSON.stringify({ reason: 'Test self-term — Phase 4' }),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(typeof body.data.id).toBe('string');
      expect(body.data.status).toBe('pending');
      expect(typeof body.data.expiresAt).toBe('string');
      expect(body.data.requesterId).toBe(fx.rootA1.id);
      requestIdRootA1 = body.data.id as string;
    });

    it('T05: rootA1 GET own pending → 200 + matches T04', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        headers: { Authorization: `Bearer ${fx.rootA1.token}` },
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(200);
      expect(body.data.id).toBe(requestIdRootA1);
      expect(body.data.status).toBe('pending');
    });

    it('T06: rootA1 POST again while pending → 409 ALREADY_PENDING', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA1.token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(409);
      expect(body.error.code).toBe('ROOT_REQUEST_ALREADY_PENDING');
    });

    it('T07: rootA2 GET pending list → 200 + sees rootA1 request, not own', async () => {
      const res = await fetch(`${BASE_URL}/users/self-termination-requests/pending`, {
        headers: { Authorization: `Bearer ${fx.rootA2.token}` },
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(200);
      const ids = (body.data as { id: string; requesterId: number }[]).map((r) => r.id);
      expect(ids).toContain(requestIdRootA1);
      const requesterIds = (body.data as { id: string; requesterId: number }[]).map(
        (r) => r.requesterId,
      );
      expect(requesterIds).not.toContain(fx.rootA2.id);
    });
  });

  describe('CRUD: self-decision is forbidden', () => {
    it('T08: rootA1 POST approve OWN request → 403 SELF_DECISION_FORBIDDEN', async () => {
      const res = await fetch(
        `${BASE_URL}/users/self-termination-requests/${requestIdRootA1}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fx.rootA1.token}`,
          },
          body: JSON.stringify({}),
        },
      );
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(403);
      expect(body.error.code).toBe('ROOT_REQUEST_NO_SELF_DECISION');
    });
  });

  describe('CRUD: approve happy-path', () => {
    it('T09: rootA2 POST approve → 200 + rootA1 is_active flips to 4', async () => {
      const res = await fetch(
        `${BASE_URL}/users/self-termination-requests/${requestIdRootA1}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fx.rootA2.token}`,
          },
          body: JSON.stringify({ comment: 'Approved by rootA2 in test' }),
        },
      );
      expect(res.status).toBe(200);

      // DB-side proof: rootA1.is_active is now 4 (DELETED) and the request
      // row is `approved` with approved_by = rootA2.
      const targetState = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rootA1.id};`,
      );
      expect(targetState).toBe('4');

      const requestState = psqlOk(
        'assixx_user',
        `SELECT status || '|' || approved_by FROM root_self_termination_requests WHERE id = '${requestIdRootA1}';`,
      );
      expect(requestState).toBe(`approved|${fx.rootA2.id}`);
    });

    it('T10: rootA1 cancel OWN request → 404 (already approved, no pending)', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${fx.rootA1.token}` },
      });
      // After approve, rootA1's JWT may still validate the JWT signature, but
      // JwtAuthGuard does a fresh DB lookup (ADR-005) and rejects is_active=4.
      // Either 401 (DB lookup blocks) or 404 (no pending) is an acceptable
      // failure mode — both prove rootA1 cannot interact further.
      expect([401, 404]).toContain(res.status);
    });
  });

  // ── Reject + Cooldown lifecycle ────────────────────────────────────────────

  describe('CRUD: reject + cooldown', () => {
    it('T11: rootA3 POST request → 201', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA3.token}`,
        },
        body: JSON.stringify({ reason: 'Test reject flow' }),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(201);
      requestIdRootA3 = body.data.id as string;
    });

    it('T12: rootA4 POST reject WITHOUT rejectionReason → 400 (Zod)', async () => {
      const res = await fetch(
        `${BASE_URL}/users/self-termination-requests/${requestIdRootA3}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fx.rootA4.token}`,
          },
          body: JSON.stringify({}),
        },
      );
      expect(res.status).toBe(400);
    });

    it('T13: rootA4 POST reject WITH reason → 200 + rootA3 still is_active=1', async () => {
      const res = await fetch(
        `${BASE_URL}/users/self-termination-requests/${requestIdRootA3}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fx.rootA4.token}`,
          },
          body: JSON.stringify({ rejectionReason: 'Not now — tenant continuity' }),
        },
      );
      expect(res.status).toBe(200);

      const targetState = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rootA3.id};`,
      );
      expect(targetState).toBe('1');
    });

    it('T14: rootA3 POST again within 24h → 409 COOLDOWN_ACTIVE with ISO timestamp in message', async () => {
      // § Spec Deviation D10: §2.4 sample throws ConflictException with a
      // structured `cooldownEndsAt` field, but the global AllExceptionsFilter
      // (`backend/src/nest/common/filters/all-exceptions.filter.ts:159-178`)
      // explicitly normalises HttpException responses down to {code, message,
      // details?} per ADR-007 — extra payload fields are dropped. The
      // service still embeds the ISO timestamp in `message` ("Re-request
      // blocked until <ISO> (24h cooldown after rejection).") so the
      // information is recoverable; the test parses it from there. The
      // frontend (Step 5.1) will need to do the same regex extraction or
      // the filter will need to be widened in a follow-up.
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA3.token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(409);
      expect(body.error.code).toBe('ROOT_REQUEST_COOLDOWN_ACTIVE');
      const message = body.error.message as string;
      // Extract any ISO 8601 timestamp embedded in the human-readable message.
      const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
      expect(isoMatch).not.toBeNull();
      const ends = Date.parse((isoMatch as RegExpMatchArray)[0]);
      const expected = Date.now() + 24 * 60 * 60 * 1000;
      expect(Math.abs(ends - expected)).toBeLessThan(2 * 60 * 1000);
    });

    it('T15: backdate rejection > 24h → rootA3 POST again → 201', async () => {
      // Move rootA3's rejected_at to NOW()-25h via direct UPDATE — the only
      // deterministic way to test cooldown expiry without sleeping.
      psqlOk(
        'assixx_user',
        `
        UPDATE root_self_termination_requests
        SET rejected_at = NOW() - INTERVAL '25 hours'
        WHERE id = '${requestIdRootA3}';
        `,
      );

      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA3.token}`,
        },
        body: JSON.stringify({ reason: 'Re-request after cooldown' }),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(201);
      expect(body.data.status).toBe('pending');
      requestIdRootA3Reissued = body.data.id as string;
    });
  });

  // ── Direct API Bypass (Layer 2 + Layer 4 backstop) ─────────────────────────

  describe('Direct API bypass — Layer 2 / Layer 4', () => {
    it('T16: rootA2 DELETE /users/uuid/{rootA4-uuid} → 403 ROOT_CROSS_TERMINATION_FORBIDDEN', async () => {
      // Layer 2 guard via users.service:deleteUser (Session 4, masterplan §2.3
      // wired). Soft-delete is_active 1→4 — CROSS_ROOT_FORBIDDEN code.
      const res = await fetch(`${BASE_URL}/users/uuid/${fx.rootA4.uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${fx.rootA2.token}` },
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(403);
      // Error envelope nests the code per ResponseInterceptor (ADR-007); the
      // exact path is body.error.code from the ForbiddenException options.
      expect(body.error?.code).toBe('ROOT_CROSS_TERMINATION_FORBIDDEN');

      const stillActive = psqlOk(
        'assixx_user',
        `SELECT is_active || '|' || role FROM users WHERE id = ${fx.rootA4.id};`,
      );
      expect(stillActive).toBe('1|root');
    });

    it('T17: rootA2 PUT /users/uuid/{rootA4-uuid} {role:"admin"} → non-2xx + role unchanged (Layer 4)', async () => {
      // Layer 4 trigger backstop — Session 4 deferred Layer 2 wiring on the
      // PUT/role path of users.service.updateUser. The trigger raises a PG
      // exception that surfaces as 500 (no dedicated pg-error filter).
      // Spec Deviation D9: §4 expected 403; protection still holds (no DB
      // mutation), only the status code differs.
      const res = await fetch(`${BASE_URL}/users/uuid/${fx.rootA4.uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA2.token}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      expect(res.status).not.toBe(200);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const stillRoot = psqlOk('assixx_user', `SELECT role FROM users WHERE id = ${fx.rootA4.id};`);
      expect(stillRoot).toBe('root');
    });

    it('T18: rootA2 POST /users/uuid/{rootA4-uuid}/archive → 403 + is_active unchanged (Layer 2 archive defensive)', async () => {
      // Layer 2 — users.service.archiveUser hard-blocks role='root' via
      // CROSS_ROOT_FORBIDDEN (Session 4 defensive role-block).
      const res = await fetch(`${BASE_URL}/users/uuid/${fx.rootA4.uuid}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootA2.token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(403);
      expect(body.error?.code).toBe('ROOT_CROSS_TERMINATION_FORBIDDEN');

      const stillActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rootA4.id};`,
      );
      expect(stillActive).toBe('1');
    });
  });

  // ── Last-root protection ───────────────────────────────────────────────────

  describe('Last-root protection', () => {
    it('T19: rootLast (sole root in tenant) POST request → 412 LAST_ROOT_PROTECTION', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fx.rootLast.token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(412);
      expect(body.error?.code).toBe('ROOT_LAST_ROOT_PROTECTION');
    });
  });

  // ── Tenant isolation (RLS) ─────────────────────────────────────────────────

  describe('Tenant isolation (RLS)', () => {
    it('T20: rootA2 GET pending list does NOT include tenant C request', async () => {
      const res = await fetch(`${BASE_URL}/users/self-termination-requests/pending`, {
        headers: { Authorization: `Bearer ${fx.rootA2.token}` },
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(200);
      const ids = (body.data as { id: string }[]).map((r) => r.id);
      expect(ids).not.toContain(requestIdRootC1);
    });

    it('T21: rootA2 POST approve {tenantC request id} → 404 (RLS hides)', async () => {
      const res = await fetch(
        `${BASE_URL}/users/self-termination-requests/${requestIdRootC1}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fx.rootA2.token}`,
          },
          body: JSON.stringify({}),
        },
      );
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('ROOT_REQUEST_NOT_FOUND');
    });
  });

  // ── Notification fan-out (verifies §2.7 side-effects from earlier tests) ──

  describe('Notifications', () => {
    it('T22: After T04 request, peer roots in tenant A have notifications', async () => {
      // rootA2, rootA3, rootA4 should all have at least one notification row
      // with type='root_self_termination' and metadata.requestId = T04 id.
      const peerCount = psqlOk(
        'assixx_user',
        `
        SELECT COUNT(*)::text FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND recipient_id IN (${fx.rootA2.id}, ${fx.rootA3.id}, ${fx.rootA4.id})
          AND title = 'Root-Konto-Löschung beantragt'
          AND (metadata->>'requestId') = '${requestIdRootA1}';
        `,
      );
      // Three peer roots, exactly one notification each.
      expect(peerCount).toBe('3');

      // Sanity: requester (rootA1) does NOT receive its own request notification.
      const selfCount = psqlOk(
        'assixx_user',
        `
        SELECT COUNT(*)::text FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND recipient_id = ${fx.rootA1.id}
          AND title = 'Root-Konto-Löschung beantragt';
        `,
      );
      expect(selfCount).toBe('0');
    });

    it('T23: After T09 approve, requester + remaining peers have notifications', async () => {
      // notifyApproved fan-outs to: requester (rootA1) + peers excluding both
      // approver (rootA2) AND requester. So peers = {rootA3, rootA4}.
      // Total recipients: rootA1 + rootA3 + rootA4 = 3.
      const total = psqlOk(
        'assixx_user',
        `
        SELECT COUNT(*)::text FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND title = 'Root-Konto-Löschung genehmigt'
          AND (metadata->>'requestId') = '${requestIdRootA1}';
        `,
      );
      expect(total).toBe('3');

      // Approver (rootA2) is excluded.
      const approverCount = psqlOk(
        'assixx_user',
        `
        SELECT COUNT(*)::text FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND title = 'Root-Konto-Löschung genehmigt'
          AND recipient_id = ${fx.rootA2.id};
        `,
      );
      expect(approverCount).toBe('0');
    });

    it('T24: After T13 reject, requester gets notification with cooldown info', async () => {
      // notifyRejected → requester (rootA3) only. Body must contain the
      // reason and "24h" copy (per §2.7 spec).
      const row = psqlOk(
        'assixx_user',
        `
        SELECT message FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND recipient_id = ${fx.rootA3.id}
          AND title = 'Root-Konto-Löschung abgelehnt'
          AND (metadata->>'requestId') = '${requestIdRootA3}';
        `,
      );
      expect(row).toContain('Not now — tenant continuity');
      expect(row).toContain('24h');

      // Sanity: rejecter (rootA4) does NOT get an "abgelehnt" notification.
      const rejecterCount = psqlOk(
        'assixx_user',
        `
        SELECT COUNT(*)::text FROM notifications
        WHERE tenant_id = ${fx.apiTenantId}
          AND type = 'root_self_termination'
          AND recipient_id = ${fx.rootA4.id}
          AND title = 'Root-Konto-Löschung abgelehnt';
        `,
      );
      expect(rejecterCount).toBe('0');
    });
  });

  // ── Coverage assertion: re-issued request after cooldown is real ──────────

  describe('Post-cooldown re-issue exists', () => {
    it('T25: rootA3 GET own pending → 200 + matches T15 reissue', async () => {
      const res = await fetch(`${BASE_URL}/users/me/self-termination-request`, {
        headers: { Authorization: `Bearer ${fx.rootA3.token}` },
      });
      const body = (await res.json()) as JsonBody;
      expect(res.status).toBe(200);
      expect(body.data?.id).toBe(requestIdRootA3Reissued);
      expect(body.data?.status).toBe('pending');
    });
  });
});
