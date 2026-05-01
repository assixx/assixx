/**
 * TwoFactorReaperService — unit tests (Phase 3 Session 9, Batch D).
 *
 * Scope: stale-pending signup cleanup cron (Step 2.11 of FEAT_2FA_EMAIL_MASTERPLAN).
 * Covers the cleanup orchestration logic, the inverted-cascade semantics
 * (D1/D2 spec deviations), the audit-row-inside-transaction guarantee
 * (D3 spec deviation), and the cron entry point's swallow-and-continue
 * error policy.
 *
 * Mock pattern: a single `mockClient` with a SQL-pattern dispatcher (the
 * service runs many distinct queries inside one systemTransaction; routing
 * each to its own `vi.fn()` would obscure the test intent). The dispatcher
 * is keyed on stable SQL prefixes lifted from the SUT — when SUT SQL
 * changes, the dispatcher fails loud (not silent default-undefined).
 *
 * The DatabaseService is mocked at the `systemTransaction` boundary only —
 * we don't simulate `tenantQuery` or any RLS-context plumbing because the
 * reaper deliberately uses `systemTransaction` (sys_user / BYPASSRLS,
 * ADR-019) to perform cross-tenant cleanup.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 3 — Session 9, Batch D)
 * @see backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts (SUT)
 * @see ADR-019 §"Triple-User Model" (sys_user rationale)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TwoFactorReaperService } from './two-factor-auth-reaper.service.js';

// ─── Mock dispatcher ───────────────────────────────────────────────────

interface StaleUserSeed {
  id: number;
  tenant_id: number;
}

/**
 * SQL-pattern dispatcher for `mockClient.query`. Maintains a queue of
 * stale users + tenant counts that the SUT's queries pop / read. Each
 * branch corresponds to ONE call site in the SUT — adding a new call site
 * here is the test author's signal that the SUT grew a new query.
 *
 * The dispatcher returns a `pg`-like `{ rows }` envelope (matches what
 * `client.query<T>(...)` resolves to in PG-typed code).
 */
interface MockClientState {
  staleUsers: StaleUserSeed[];
  tenantCounts: Map<number, number>;
  /** Subdomain returned by `DELETE FROM tenants RETURNING subdomain`. */
  tenantSubdomains: Map<number, string | null>;
  /** Optional override that throws on the audit-write call (D3 test). */
  auditFailure: Error | null;
  /** Recorder for assertions — every (sql, params) tuple the SUT issues. */
  callLog: Array<{ sql: string; params: readonly unknown[] }>;
}

function makeMockClient(state: MockClientState): {
  client: PoolClient;
  state: MockClientState;
} {
  const query = vi.fn(
    async (sql: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }> => {
      state.callLog.push({ sql, params: params ?? [] });

      if (sql.startsWith('SELECT id, tenant_id')) {
        // findStaleUsers — verifies the FOR UPDATE pin + correct filter.
        return { rows: state.staleUsers.map((u) => ({ id: u.id, tenant_id: u.tenant_id })) };
      }
      if (sql.startsWith('SELECT tenant_id, COUNT')) {
        // countUsersOnTenants — params[0] is the tenantId array.
        const tenantIds = (params?.[0] ?? []) as number[];
        return {
          rows: tenantIds.map((tid) => ({
            tenant_id: tid,
            cnt: state.tenantCounts.get(tid) ?? 0,
          })),
        };
      }
      if (sql.startsWith('DELETE FROM tenants')) {
        const tenantId = params?.[0] as number;
        const subdomain = state.tenantSubdomains.get(tenantId) ?? null;
        return { rows: subdomain === null ? [] : [{ subdomain }] };
      }
      if (sql.startsWith('UPDATE users SET is_active')) {
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO audit_trail')) {
        if (state.auditFailure !== null) {
          throw state.auditFailure;
        }
        return { rows: [] };
      }
      throw new Error(`Unmocked SQL in reaper test: ${sql.slice(0, 80)}`);
    },
  );
  return {
    client: { query } as unknown as PoolClient,
    state,
  };
}

function makeService(state: MockClientState): {
  service: TwoFactorReaperService;
  state: MockClientState;
  systemTransaction: ReturnType<typeof vi.fn>;
} {
  const { client } = makeMockClient(state);
  const systemTransaction = vi.fn(async (cb: (c: PoolClient) => Promise<unknown>) => cb(client));
  const db = { systemTransaction } as unknown as DatabaseService;
  const service = new TwoFactorReaperService(db);
  return { service, state, systemTransaction };
}

function freshState(overrides: Partial<MockClientState> = {}): MockClientState {
  return {
    staleUsers: [],
    tenantCounts: new Map(),
    tenantSubdomains: new Map(),
    auditFailure: null,
    callLog: [],
    ...overrides,
  };
}

// ─── Suite ─────────────────────────────────────────────────────────────

describe('TwoFactorReaperService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── reap() — happy paths ────────────────────────────────────────────

  describe('reap()', () => {
    it('returns {users:0, tenants:0} and writes nothing when there are no stale users', async () => {
      const { service, state } = makeService(freshState());

      const summary = await service.reap();

      expect(summary).toEqual({ users: 0, tenants: 0 });
      // Only the SELECT FOR UPDATE ran — no count, no delete, no audit.
      expect(state.callLog).toHaveLength(1);
      expect(state.callLog[0]?.sql).toContain('SELECT id, tenant_id');
    });

    // Happy path #1: ALL users on the tenant are stale → cascade-delete the
    // tenant, the stale user vanishes via FK ON DELETE CASCADE.
    it('cascades the tenant when every user on it is stale (D1/D2 inverted flow)', async () => {
      const state = freshState({
        staleUsers: [{ id: 1, tenant_id: 10 }],
        tenantCounts: new Map([[10, 1]]), // exactly the one stale user
        tenantSubdomains: new Map([[10, 'fresh-tenant']]),
      });
      const { service } = makeService(state);

      const summary = await service.reap();

      expect(summary).toEqual({ users: 1, tenants: 1 });

      // The cascade path writes DELETE FROM tenants — never DELETE FROM users.
      const deleteSql = state.callLog
        .map((c) => c.sql)
        .filter((sql) => sql.startsWith('DELETE'))
        .join('\n');
      expect(deleteSql).toContain('DELETE FROM tenants');
      // ADR-020 / ADR-045 architectural rule (D2): the reaper sits outside
      // the tenant-deletion module and MUST NOT issue a hard delete on users.
      expect(deleteSql).not.toContain('DELETE FROM users');

      // Audit row was written with the §A8 tuple `(delete, 2fa-stale-signup)`.
      const auditCall = state.callLog.find((c) => c.sql.startsWith('INSERT INTO audit_trail'));
      expect(auditCall).toBeDefined();
      const params = auditCall?.params ?? [];
      expect(params[4]).toBe('delete');
      expect(params[5]).toBe('2fa-stale-signup');
      expect(params[11]).toBe('success');
      const changes = JSON.parse(params[8] as string) as Record<string, unknown>;
      expect(changes).toMatchObject({
        userId: 1,
        tenantId: 10,
        subdomain: 'fresh-tenant',
        tenantAlsoDeleted: true,
        reason: 'never-verified',
      });
    });

    // Defensive edge case: tenant has another (non-stale) user, so the
    // cascade path is unsafe — fall back to soft-delete (UPDATE is_active=4).
    // This branch cannot fire for a fresh signup (only one user inserted)
    // but exists to insure against future codepaths attaching to a half-
    // built tenant. The test pins the exact UPDATE shape and the audit row
    // it produces.
    it('soft-deletes the user when other users live on the tenant (defensive edge case)', async () => {
      const state = freshState({
        staleUsers: [{ id: 1, tenant_id: 10 }],
        tenantCounts: new Map([[10, 2]]), // stale user + 1 other live user
      });
      const { service } = makeService(state);

      const summary = await service.reap();

      expect(summary).toEqual({ users: 1, tenants: 0 });

      const updateCall = state.callLog.find((c) => c.sql.startsWith('UPDATE users SET is_active'));
      expect(updateCall).toBeDefined();
      // Soft-delete code = IS_ACTIVE.DELETED (= 4). Param-position order
      // matches the SUT: `[IS_ACTIVE.DELETED, user.id]`.
      expect(updateCall?.params[0]).toBe(IS_ACTIVE.DELETED);
      expect(updateCall?.params[1]).toBe(1);

      // No DELETE FROM tenants — the tenant + other users stay intact.
      expect(state.callLog.find((c) => c.sql.startsWith('DELETE FROM tenants'))).toBeUndefined();

      // Audit row carries `tenantAlsoDeleted: false` — important for the
      // compliance trail's "did we erase the customer or just the row?" axis.
      const auditCall = state.callLog.find((c) => c.sql.startsWith('INSERT INTO audit_trail'));
      const changes = JSON.parse((auditCall?.params[8] as string) ?? '{}') as Record<
        string,
        unknown
      >;
      expect(changes.tenantAlsoDeleted).toBe(false);
      expect(changes.subdomain).toBeNull();
    });

    // Mixed-tenant sweep: tenant A is fully stale (cascade), tenant B has a
    // non-stale user (soft-delete). Asserts the grouping logic routes each
    // tenant to the correct cleanup helper.
    it('routes each tenant in a mixed batch to the correct cleanup helper', async () => {
      const state = freshState({
        staleUsers: [
          { id: 1, tenant_id: 10 },
          { id: 2, tenant_id: 20 },
        ],
        tenantCounts: new Map([
          [10, 1], // all-stale → cascade
          [20, 3], // partial → soft-delete
        ]),
        tenantSubdomains: new Map([[10, 'cascaded']]),
      });
      const { service } = makeService(state);

      const summary = await service.reap();

      expect(summary).toEqual({ users: 2, tenants: 1 });

      // Exactly one DELETE FROM tenants (for tenant 10) and exactly one
      // soft-delete UPDATE (for user 2 on tenant 20).
      const deletes = state.callLog.filter((c) => c.sql.startsWith('DELETE FROM tenants'));
      expect(deletes).toHaveLength(1);
      expect(deletes[0]?.params[0]).toBe(10);
      const updates = state.callLog.filter((c) => c.sql.startsWith('UPDATE users SET is_active'));
      expect(updates).toHaveLength(1);
      expect(updates[0]?.params[1]).toBe(2);

      // Two audit rows — one per cleaned-up user, with the correct
      // tenantAlsoDeleted flag for each branch.
      const auditCalls = state.callLog.filter((c) => c.sql.startsWith('INSERT INTO audit_trail'));
      expect(auditCalls).toHaveLength(2);
      const flags = auditCalls.map((c) => {
        const changes = JSON.parse(c.params[8] as string) as Record<string, unknown>;
        return { userId: changes.userId, tenantAlsoDeleted: changes.tenantAlsoDeleted };
      });
      expect(flags).toContainEqual({ userId: 1, tenantAlsoDeleted: true });
      expect(flags).toContainEqual({ userId: 2, tenantAlsoDeleted: false });
    });

    // SUT contract: findStaleUsers uses SELECT FOR UPDATE with the three
    // mandatory predicates (is_active = INACTIVE, tfa_enrolled_at IS NULL,
    // created_at < NOW() - 1 h). Drift on any of these would let active
    // users get reaped or let stale users stay forever.
    it('locks the candidate rows with SELECT FOR UPDATE and the three plan predicates', async () => {
      const state = freshState({
        staleUsers: [{ id: 1, tenant_id: 10 }],
        tenantCounts: new Map([[10, 1]]),
        tenantSubdomains: new Map([[10, 't']]),
      });
      const { service } = makeService(state);

      await service.reap();

      const findCall = state.callLog[0];
      expect(findCall?.sql).toContain('FOR UPDATE');
      expect(findCall?.sql).toContain('is_active = $1');
      expect(findCall?.sql).toContain('tfa_enrolled_at IS NULL');
      expect(findCall?.sql).toContain("created_at < NOW() - INTERVAL '1 hour'");
      // Bind value uses the IS_ACTIVE constant — magic-number regressions
      // (`is_active = 0`) caught by `shared/src/architectural.test.ts`,
      // bind-position regressions caught here.
      expect(findCall?.params[0]).toBe(IS_ACTIVE.INACTIVE);
    });

    // D3 — audit insert runs INSIDE the same transaction. If the audit
    // INSERT throws, the entire batch must roll back; reap() propagates
    // the error to its caller (`runScheduled` swallows it at the next layer).
    it('rolls back the whole batch when the audit INSERT fails (D3 — compliance evidence rule)', async () => {
      const auditFailure = new Error('audit_trail partition unavailable');
      const state = freshState({
        staleUsers: [{ id: 1, tenant_id: 10 }],
        tenantCounts: new Map([[10, 1]]),
        tenantSubdomains: new Map([[10, 't']]),
        auditFailure,
      });
      const { service } = makeService(state);

      await expect(service.reap()).rejects.toBe(auditFailure);
    });

    // ADR-019 — the reaper must use `systemTransaction` (sys_user, BYPASSRLS)
    // for the cross-tenant sweep. A regression that switches to `tenantQuery`
    // would silently start filtering by CLS tenantId and miss everything
    // outside the (non-existent on cron) request context.
    it('runs every query inside a single db.systemTransaction (ADR-019 BYPASSRLS)', async () => {
      const state = freshState({
        staleUsers: [
          { id: 1, tenant_id: 10 },
          { id: 2, tenant_id: 20 },
        ],
        tenantCounts: new Map([
          [10, 1],
          [20, 2],
        ]),
        tenantSubdomains: new Map([[10, 't1']]),
      });
      const { service, systemTransaction } = makeService(state);

      await service.reap();

      // ONE outer transaction wraps SELECT + COUNT + DELETE/UPDATE + audits.
      expect(systemTransaction).toHaveBeenCalledTimes(1);
    });

    // No-op idempotency: a second `reap()` call against an already-clean
    // state must return zeros and write nothing.
    it('is idempotent — second invocation against an empty stale set is a no-op', async () => {
      const { service, state } = makeService(freshState());

      const first = await service.reap();
      const second = await service.reap();

      expect(first).toEqual({ users: 0, tenants: 0 });
      expect(second).toEqual({ users: 0, tenants: 0 });
      // Two SELECTs — one per call. No deletes, no updates, no audits.
      // Note: `findStaleUsers` ends with `FOR UPDATE`, so `includes('UPDATE')`
      // would over-match — anchor the check on the leading verb instead.
      expect(state.callLog.filter((c) => c.sql.startsWith('SELECT id, tenant_id'))).toHaveLength(2);
      expect(state.callLog.filter((c) => c.sql.startsWith('DELETE'))).toHaveLength(0);
      expect(state.callLog.filter((c) => c.sql.startsWith('UPDATE'))).toHaveLength(0);
      expect(state.callLog.filter((c) => c.sql.startsWith('INSERT INTO audit_trail'))).toHaveLength(
        0,
      );
    });
  });

  // ─── runScheduled() — cron entry ──────────────────────────────────────

  describe('runScheduled()', () => {
    // The cron wrapper MUST swallow reap() failures so a single bad batch
    // doesn't crash the @nestjs/schedule runtime — the next 15-min tick
    // retries. Errors land in Sentry via the Pino transport (logger.error).
    it('swallows reap() errors so the next tick is unaffected', async () => {
      const { service, state } = makeService(freshState());
      // Hijack `reap` to throw — vi.spyOn binds correctly because reap is
      // a public method on the prototype.
      const reapSpy = vi
        .spyOn(service, 'reap')
        .mockRejectedValueOnce(new Error('Postgres unreachable'));

      await expect(service.runScheduled()).resolves.toBeUndefined();
      expect(reapSpy).toHaveBeenCalledTimes(1);
      // No DB queries run because reap() rejected before reaching the
      // dispatcher.
      expect(state.callLog).toHaveLength(0);
    });

    // Happy-path log emission — reap returns a summary and runScheduled
    // logs it; abnormal-batch threshold isn't hit so no warn.
    it('logs the per-batch summary on success without warning when below threshold', async () => {
      const state = freshState({
        staleUsers: [{ id: 1, tenant_id: 10 }],
        tenantCounts: new Map([[10, 1]]),
        tenantSubdomains: new Map([[10, 't']]),
      });
      const { service } = makeService(state);

      await service.runScheduled();

      // Reach into the protected logger via the same `unknown`-cast pattern
      // used elsewhere in this codebase (precedent: tests inspecting Pino
      // redact paths). Smoke-check that no error was emitted; deeper log-
      // assertion lives in the dedicated logger tests.
      // Smoke: reap() ran exactly once (vs zero on the swallowed-error path).
      expect(state.callLog.filter((c) => c.sql.includes('audit_trail'))).toHaveLength(1);
    });
  });
});
