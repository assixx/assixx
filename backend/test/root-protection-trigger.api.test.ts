/**
 * Layer 4 trigger integration tests — Phase 3 / Session 7c
 *
 * Verifies `fn_prevent_cross_root_change` (BEFORE UPDATE OR DELETE on `users`)
 * by issuing real SQL against the live `assixx-postgres` container as the three
 * documented DB roles:
 *   - `app_user`     — RLS-bound, application requests (must be blocked)
 *   - `sys_user`     — BYPASSRLS, cron / auth / signup / root admin (must bypass)
 *   - `assixx_user`  — BYPASSRLS + DDL, migrations / cleanup (must bypass)
 *
 * Why this file is in `backend/test/` (not collocated with the service unit
 * tests in `backend/src/nest/root/`): the trigger's `current_user IN
 * ('assixx_user', 'sys_user')` bypass branch can only be exercised by issuing
 * raw SQL as those exact PostgreSQL roles. The HTTP harness always reaches the
 * DB via the application pool (`app_user` + `tenantTransaction()`), so it
 * cannot reach the bypass paths. The repo convention for test code that needs
 * direct psql access is `execSync('docker exec assixx-postgres psql -U <user>')`
 * — see `backend/test/inventory.api.test.ts` and `auth-password-reset.api.test.ts`
 * for the established pattern.
 *
 * Test data is isolated in TWO dedicated tenants created in `beforeAll`:
 *   - `rootprot1-<runtag>` — 9 root users (covers tests 1-7)
 *   - `rootprot2-<runtag>` — 1 root user (covers test 8 last-root protection)
 * Both are dropped in `afterAll` via `DELETE FROM tenants ... CASCADE` as
 * `assixx_user` — the trigger bypasses for that role, so cleanup never blocks
 * even though some rows have been mutated to is_active=4 / 0 by the bypass tests.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §3 DB-Trigger Integration
 * @see database/migrations/20260426191336202_root-protection-trigger.ts
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md (Triple-User-Model)
 */
import { execSync } from 'node:child_process';

// ─── psql helpers (Unix-socket peer auth inside the container — no password) ──

type DbUser = 'app_user' | 'assixx_user' | 'sys_user';

interface ExecError extends Error {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
  status?: number;
}

/**
 * Run a SQL script as the given DB user. Throws if psql exits non-zero.
 * Returns trimmed stdout. Use for setup, fixture creation, and "happy" cases.
 */
function psqlOk(user: DbUser, sql: string): string {
  return execSync(
    `docker exec -i assixx-postgres psql -U ${user} -d assixx -tA -F '|' -v ON_ERROR_STOP=1`,
    { input: sql, stdio: ['pipe', 'pipe', 'pipe'] },
  )
    .toString()
    .trim();
}

/**
 * Run a SQL script as the given DB user, asserting that psql exits non-zero.
 * Returns the captured stderr so the caller can match against the trigger's
 * RAISE EXCEPTION code. Throws if the command unexpectedly succeeds.
 */
function psqlExpectError(user: DbUser, sql: string): string {
  try {
    execSync(`docker exec -i assixx-postgres psql -U ${user} -d assixx -v ON_ERROR_STOP=1`, {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      throw new Error(`psql failed but error was not an Error: ${String(err)}`, { cause: err });
    }
    const stderr = (err as ExecError).stderr;
    return stderr === undefined ? '' : stderr.toString();
  }
  throw new Error('Expected SQL command to fail (trigger RAISE EXCEPTION), but it succeeded.');
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface RootUser {
  id: number;
  email: string;
}

interface FixtureState {
  t1Id: number;
  t1Name: string;
  t2Id: number;
  t2Name: string;
  rActor: RootUser;
  rTarget: RootUser;
  rSelfNoGuc: RootUser;
  rSelfNoRow: RootUser;
  rSelfValid: RootUser;
  rSelfStale: RootUser;
  rBypassAssixx: RootUser;
  rBypassSys: RootUser;
  rApprover: RootUser;
  rLast: RootUser;
}

// Run-tag suffix keeps fixture rows unique across overlapping runs (CI matrix /
// rapid-fire local re-runs while `afterAll` from the prior run hasn't finished).
const RUN_TAG = `s7c${Date.now()}`;
const T1_NAME = `rootprot1-${RUN_TAG}`;
const T2_NAME = `rootprot2-${RUN_TAG}`;

// Roles that this test populates in T1 (one root per scenario for order-independence).
// `r-last` is in T2 so it's the only active root in its tenant — required for
// the last-root protection test.
const T1_LABELS = [
  'r-actor',
  'r-target',
  'r-self-noguc',
  'r-self-norow',
  'r-self-valid',
  'r-self-stale',
  'r-bypass-assixx',
  'r-bypass-sys',
  'r-approver',
] as const;

let fx: FixtureState;

beforeAll((): void => {
  // Step 1: create both tenants + 10 root users in one transactional script.
  // Run as assixx_user so RLS doesn't block writes spanning two tenants.
  // Password is intentionally a placeholder string — these users never log in.
  //
  // Pattern: tenant_id resolved via sub-SELECT per row (PostgreSQL allows
  // scalar sub-queries inside VALUES). Two separate INSERTs (one per tenant)
  // would also work, but a single INSERT is atomic and easier to reason about.
  // has_full_access MUST be true for role='root' (chk_root_full_access constraint
  // from migration 20260207000000020_root-must-have-full-access.ts).
  const t1Rows = T1_LABELS.map(
    (label) =>
      `((SELECT id FROM tenants WHERE subdomain = '${T1_NAME}'), '${label}@${T1_NAME}.test', '${label}@${T1_NAME}.test', 'TRG-${label}', 'disabled', 'root', true, gen_random_uuid()::char(36), 1)`,
  );
  const t2Row = `((SELECT id FROM tenants WHERE subdomain = '${T2_NAME}'), 'r-last@${T2_NAME}.test', 'r-last@${T2_NAME}.test', 'TRG-r-last', 'disabled', 'root', true, gen_random_uuid()::char(36), 1)`;
  const userValues = [...t1Rows, t2Row].join(',\n      ');

  psqlOk(
    'assixx_user',
    `
    BEGIN;

    INSERT INTO tenants (company_name, subdomain, email, uuid, uuid_created_at)
    VALUES
      ('Root Prot Test T1', '${T1_NAME}', 'admin@${T1_NAME}.test', gen_random_uuid()::char(36), NOW()),
      ('Root Prot Test T2', '${T2_NAME}', 'admin@${T2_NAME}.test', gen_random_uuid()::char(36), NOW());

    INSERT INTO users
      (tenant_id, username, email, employee_number, password, role, has_full_access, uuid, is_active)
    VALUES
      ${userValues};

    COMMIT;
    `,
  );

  // Step 2: read back the IDs in one tagged query. Output format: `tag|id` per line.
  const idQuery = `
    SELECT 't1|' || id FROM tenants WHERE subdomain = '${T1_NAME}'
    UNION ALL SELECT 't2|' || id FROM tenants WHERE subdomain = '${T2_NAME}'
    ${T1_LABELS.map(
      (label) =>
        `UNION ALL SELECT '${label}|' || id FROM users WHERE email = '${label}@${T1_NAME}.test'`,
    ).join('\n    ')}
    UNION ALL SELECT 'r-last|' || id FROM users WHERE email = 'r-last@${T2_NAME}.test';
  `;
  const out = psqlOk('assixx_user', idQuery);

  const idMap = new Map<string, number>();
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || !trimmed.includes('|')) continue;
    const [tag, idStr] = trimmed.split('|');
    if (tag === undefined || idStr === undefined) continue;
    idMap.set(tag, Number(idStr));
  }

  function need(tag: string): number {
    const id = idMap.get(tag);
    if (id === undefined) {
      throw new Error(`Fixture setup: missing id for tag '${tag}'. Got: ${out}`);
    }
    return id;
  }

  function user(tag: string, tenantName: string): RootUser {
    return { id: need(tag), email: `${tag}@${tenantName}.test` };
  }

  fx = {
    t1Id: need('t1'),
    t1Name: T1_NAME,
    t2Id: need('t2'),
    t2Name: T2_NAME,
    rActor: user('r-actor', T1_NAME),
    rTarget: user('r-target', T1_NAME),
    rSelfNoGuc: user('r-self-noguc', T1_NAME),
    rSelfNoRow: user('r-self-norow', T1_NAME),
    rSelfValid: user('r-self-valid', T1_NAME),
    rSelfStale: user('r-self-stale', T1_NAME),
    rBypassAssixx: user('r-bypass-assixx', T1_NAME),
    rBypassSys: user('r-bypass-sys', T1_NAME),
    rApprover: user('r-approver', T1_NAME),
    rLast: user('r-last', T2_NAME),
  };
});

afterAll((): void => {
  // Cleanup order matters: `users.tenant_id` has ON DELETE RESTRICT (not CASCADE),
  // so tenants cannot be dropped until their users are gone. We hard-delete in
  // FK-safe order:
  //   1. root_self_termination_requests rows (CASCADEs from users would also
  //      catch them, but explicit is faster and clearer)
  //   2. users in both tenants — the trigger bypasses for assixx_user, so this
  //      works for the still-active roots AND the test-mutated ones (is_active
  //      4 / 0 from the bypass scenarios)
  //   3. tenants by subdomain
  // assixx_user (BYPASSRLS + SUPERUSER) is the only role that can do all three
  // without RLS / trigger interference.
  psqlOk(
    'assixx_user',
    `
    DELETE FROM root_self_termination_requests WHERE tenant_id IN (${fx.t1Id}, ${fx.t2Id});
    DELETE FROM users WHERE tenant_id IN (${fx.t1Id}, ${fx.t2Id});
    DELETE FROM tenants WHERE subdomain IN ('${T1_NAME}', '${T2_NAME}');
    `,
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Layer 4 trigger — fn_prevent_cross_root_change', () => {
  // ── Scenario 1: cross-root via app_user is forbidden ──────────────────────

  describe('Cross-root protection (app_user)', () => {
    it('blocks app_user cross-root soft-delete with ROOT_CROSS_TERMINATION_FORBIDDEN', () => {
      const stderr = psqlExpectError(
        'app_user',
        `
        SET app.tenant_id = '${fx.t1Id}';
        SET app.user_id = '${fx.rActor.id}';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rTarget.id};
        `,
      );
      expect(stderr).toContain('ROOT_CROSS_TERMINATION_FORBIDDEN');

      // Sanity: target row is unchanged after the blocked UPDATE.
      const stillActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rTarget.id};`,
      );
      expect(stillActive).toBe('1');
    });
  });

  // ── Scenario 2-5: self-termination must come through the approval flow ────

  describe('Self-termination requires approval (app_user)', () => {
    it('blocks self-termination without GUC with ROOT_SELF_TERMINATION_REQUIRES_APPROVAL', () => {
      const stderr = psqlExpectError(
        'app_user',
        `
        SET app.tenant_id = '${fx.t1Id}';
        SET app.user_id = '${fx.rSelfNoGuc.id}';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rSelfNoGuc.id};
        `,
      );
      expect(stderr).toContain('ROOT_SELF_TERMINATION_REQUIRES_APPROVAL');
    });

    it('blocks self with GUC=true but no approved DB row with ROOT_NO_APPROVED_REQUEST', () => {
      // Hybrid Option 1+ defense: forged GUC alone is not enough; the trigger
      // re-checks that a real `approved` row exists in the 5-min window.
      const stderr = psqlExpectError(
        'app_user',
        `
        SET app.tenant_id = '${fx.t1Id}';
        SET app.user_id = '${fx.rSelfNoRow.id}';
        SET app.root_self_termination_approved = 'true';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rSelfNoRow.id};
        `,
      );
      expect(stderr).toContain('ROOT_NO_APPROVED_REQUEST');
    });

    it('blocks self with GUC=true + stale (>5min) approved row with ROOT_NO_APPROVED_REQUEST', () => {
      // Insert an approved row with approved_at = NOW() - 6min (outside the
      // 5-min window). The trigger should still reject. Using assixx_user
      // (BYPASSRLS) for the seed — RLS write would otherwise need app.tenant_id.
      psqlOk(
        'assixx_user',
        `
        INSERT INTO root_self_termination_requests
          (id, tenant_id, requester_id, status, expires_at, approved_by, approved_at)
        VALUES
          (uuidv7(), ${fx.t1Id}, ${fx.rSelfStale.id}, 'approved',
           NOW() + INTERVAL '7 days', ${fx.rApprover.id}, NOW() - INTERVAL '6 minutes');
        `,
      );

      const stderr = psqlExpectError(
        'app_user',
        `
        SET app.tenant_id = '${fx.t1Id}';
        SET app.user_id = '${fx.rApprover.id}';
        SET app.root_self_termination_approved = 'true';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rSelfStale.id};
        `,
      );
      expect(stderr).toContain('ROOT_NO_APPROVED_REQUEST');

      // Sanity: target was not mutated.
      const stillActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rSelfStale.id};`,
      );
      expect(stillActive).toBe('1');
    });

    it('allows self with GUC=true + valid approved row within 5-min window', () => {
      // The legitimate approve flow: actor=approver, target=requester (cross-root
      // by design). The trigger's Hybrid Option 1+ branch sees a fresh approved
      // row and skips the cross-root check. Last-root protection still passes
      // because T1 has 9 roots all is_active=1 at this point in the suite.
      psqlOk(
        'assixx_user',
        `
        INSERT INTO root_self_termination_requests
          (id, tenant_id, requester_id, status, expires_at, approved_by, approved_at)
        VALUES
          (uuidv7(), ${fx.t1Id}, ${fx.rSelfValid.id}, 'approved',
           NOW() + INTERVAL '7 days', ${fx.rApprover.id}, NOW());
        `,
      );

      psqlOk(
        'app_user',
        `
        SET app.tenant_id = '${fx.t1Id}';
        SET app.user_id = '${fx.rApprover.id}';
        SET app.root_self_termination_approved = 'true';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rSelfValid.id};
        `,
      );

      const isActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rSelfValid.id};`,
      );
      expect(isActive).toBe('4');
    });
  });

  // ── Scenario 6-7: system-user bypass paths ────────────────────────────────

  describe('System-user bypass (no GUCs needed)', () => {
    it('assixx_user bypasses trigger entirely', () => {
      // No SET app.user_id, no approval flag — would block as app_user.
      psqlOk('assixx_user', `UPDATE users SET is_active = 4 WHERE id = ${fx.rBypassAssixx.id};`);
      const isActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rBypassAssixx.id};`,
      );
      expect(isActive).toBe('4');
    });

    it('sys_user bypasses trigger entirely', () => {
      // sys_user is the production identity for cron / auth / signup / root admin
      // and tenant deletion — all paths that legitimately need cross-tenant or
      // contextless writes. The trigger MUST yield to it without any GUC plumbing.
      psqlOk('sys_user', `UPDATE users SET is_active = 0 WHERE id = ${fx.rBypassSys.id};`);
      const isActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rBypassSys.id};`,
      );
      expect(isActive).toBe('0');
    });
  });

  // ── Scenario 8: last-root protection wins even with valid approval ────────

  describe('Last-root protection (always enforced)', () => {
    it('blocks self-termination of the only active root with ROOT_LAST_ROOT_PROTECTION', () => {
      // T2 has exactly 1 active root (r-last). Even with the full approval gate
      // satisfied (valid approved row + GUC + non-self actor), the trigger must
      // refuse — terminating r-last would leave T2 with 0 active roots.
      // approved_by points at an approver from T1; the FK is a plain users.id
      // reference with no tenant scoping.
      psqlOk(
        'assixx_user',
        `
        INSERT INTO root_self_termination_requests
          (id, tenant_id, requester_id, status, expires_at, approved_by, approved_at)
        VALUES
          (uuidv7(), ${fx.t2Id}, ${fx.rLast.id}, 'approved',
           NOW() + INTERVAL '7 days', ${fx.rApprover.id}, NOW());
        `,
      );

      const stderr = psqlExpectError(
        'app_user',
        `
        SET app.tenant_id = '${fx.t2Id}';
        SET app.user_id = '${fx.rApprover.id}';
        SET app.root_self_termination_approved = 'true';
        UPDATE users SET is_active = 4 WHERE id = ${fx.rLast.id};
        `,
      );
      expect(stderr).toContain('ROOT_LAST_ROOT_PROTECTION');

      // Sanity: r-last was NOT mutated.
      const stillActive = psqlOk(
        'assixx_user',
        `SELECT is_active FROM users WHERE id = ${fx.rLast.id};`,
      );
      expect(stillActive).toBe('1');
    });
  });
});
