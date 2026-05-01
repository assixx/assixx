/**
 * Stale-Pending Reaper Cron — Step 2.11 of FEAT_2FA_EMAIL_MASTERPLAN.md.
 *
 * WHY THIS EXISTS:
 *   DD-14 (`SignupService.cleanupFailedSignup`) handles the SMTP-fails-
 *   synchronously case. This reaper handles the second leak path: signup
 *   succeeds, mail leaves the building, user closes the tab without ever
 *   entering the code. Without this sweep, the `users` row sits at
 *   `is_active = INACTIVE` indefinitely and the `tenants` row keeps the
 *   subdomain reserved → an attacker can squat any premium subdomain by
 *   scripted signup-then-close, and a legitimate user retrying signup an
 *   hour later sees "Email already in use".
 *
 * SCHEDULE: every 15 minutes (`'0 *\/15 * * * *'`). DD-29 (v0.4.0)
 * resolution: main backend with `@nestjs/schedule`, NOT a separate worker.
 * `ScheduleModule.forRoot()` is registered globally in `app.module.ts:111`,
 * so this provider needs no per-module import. The deletion-worker
 * container uses a separate entrypoint (`workers/deletion-worker.js`)
 * loading `DeletionWorkerModule`, NOT `AppModule` — so this @Cron fires
 * exactly once per tick on V1 (single-replica main backend).
 *
 * AGE THRESHOLD: 1 hour (vs the 10-min challenge TTL). The challenge
 * itself expires after 10 min (R2 / DD-2), but we leave the user row
 * around longer so a legitimate user who comes back to a half-finished
 * signup within the hour gets a clearer "already in use" or can resume
 * via the controller's existing path. After 1 h with no enrollment the
 * row is dead-weight.
 *
 * DELIBERATE SPEC DEVIATIONS FROM MASTERPLAN §2.11 (logged in §Spec
 * Deviations):
 *   D1. The plan's literal CTE deletes from `users` first then runs
 *       `NOT EXISTS (SELECT 1 FROM users WHERE …)` to find orphan
 *       tenants. PostgreSQL DML CTEs share the statement-start snapshot
 *       (https://www.postgresql.org/docs/current/queries-with.html —
 *       "they cannot see one another's effects on the target tables"),
 *       so the to-be-deleted user is STILL visible to that NOT EXISTS
 *       and the orphan-check returns false → tenants would never be
 *       reaped. Inverted flow: delete the tenant first; the FK cascade
 *       cleans up the user row in the same statement.
 *
 *       FK-CASCADE FIX SHIPPED 2026-05-01 (masterplan §Spec Deviations
 *       D4 / v0.8.4 → v0.8.13): node-pg-migrate
 *       `20260501012903758_flip-fk-users-tenant-on-delete-cascade`
 *       flipped `fk_users_tenant` from `ON DELETE RESTRICT` to
 *       `ON DELETE CASCADE` (verified `pg_constraint.confdeltype='c'`).
 *       The `dropTenantCascade` branch is now correct end-to-end and
 *       the §0.4 / DD-14 anti-subdomain-squatting guarantee is
 *       restored. Earlier comment iterations (v0.8.0–v0.8.3) carried
 *       a "KNOWN PRODUCTION FAILURE" warning describing the pre-fix
 *       RESTRICT behaviour — superseded by this note.
 *   D2. `shared/src/architectural.test.ts:291` blocks `DELETE FROM
 *       users` outside the tenant-deletion module (ADR-020 + ADR-045
 *       soft-delete-only rule). The inverted flow doubles as the
 *       dodge: we never write `DELETE FROM users` — only `DELETE FROM
 *       tenants` — same trick `signup.service.ts:cleanupFailedSignup`
 *       already uses for DD-14. Edge case where a tenant has additional
 *       non-stale users (the only path that currently succeeds in prod,
 *       per the D1 warning above) falls back to `UPDATE users SET
 *       is_active = IS_ACTIVE.DELETED` (soft-delete) for the stale rows.
 *   D3. The audit_trail INSERT runs INSIDE the same systemTransaction
 *       as the cleanup (NOT fire-and-forget like
 *       `TwoFactorAuthService.fireAudit`). Reaper deletions are
 *       compliance evidence — if the audit insert fails, the whole
 *       batch must roll back. `audit_trail.tenant_id` has no FK to
 *       `tenants` (partition table by design — confirmed via
 *       `\d audit_trail` 2026-04-29), so the audit row writes
 *       successfully whether the tenant survives the sweep
 *       (soft-delete branch) or — once the Phase 6 FK migration ships
 *       — has been cascaded away (`dropTenantCascade` branch).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §2.11 (verbatim spec)
 * @see backend/src/nest/root/root-self-termination.cron.ts (sibling cron pattern)
 * @see backend/src/nest/signup/signup.service.ts (cleanupFailedSignup — same inverted-cascade trick)
 * @see ADR-019 (RLS — sys_user / BYPASSRLS rationale for `systemTransaction`)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * Per-batch threshold above which the reaper logs a warn-level signal —
 * "100 in one 15-min window" projects to >400/hour, well above the plan's
 * "100/hour" alarm bar. Ops dashboards (Loki / Sentry-via-Pino) pick this
 * up via the warn level. Conservative threshold: V2 may dial it to a true
 * sliding-window 100/hour if we see false positives.
 */
const ABNORMAL_BATCH_THRESHOLD = 100;

interface StaleUserRow {
  id: number;
  tenant_id: number;
}

interface TenantUserCountRow {
  tenant_id: number;
  cnt: number;
}

interface CleanupOutcome {
  userId: number;
  tenantId: number;
  /** Non-null only when the tenant was deleted via cascade. */
  subdomain: string | null;
  /** True when the user vanished via tenant cascade; false when soft-deleted in place. */
  viaCascade: boolean;
}

@Injectable()
export class TwoFactorReaperService {
  private readonly logger = new Logger(TwoFactorReaperService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Cron entry — runs every 15 min. Wraps `reap()` in a try/catch so a
   * single-batch failure never crashes the scheduler; the next tick
   * fires regardless and Sentry sees the error via the Pino transport.
   * Six-field cron expression `sec min hour dom mon dow` — `'0 *\/15 * * * *'`
   * fires at second 0 of minutes 0/15/30/45.
   */
  @Cron('0 */15 * * * *', { name: 'two-factor-stale-pending-reaper' })
  async runScheduled(): Promise<void> {
    try {
      const summary = await this.reap();
      this.logger.log(
        `Stale-pending reaper: deleted ${summary.users} user(s), ${summary.tenants} orphan tenant(s)`,
      );
      if (summary.users > ABNORMAL_BATCH_THRESHOLD) {
        // Volume-anomaly signal — bug or attack. Plan §2.11 calls for an
        // alert; warn-level is sufficient for the Pino → Sentry path.
        this.logger.warn(
          `Stale-pending reaper batch above threshold (${summary.users} > ${ABNORMAL_BATCH_THRESHOLD}) — investigate (likely bug or signup-flood attack)`,
        );
      }
    } catch (error: unknown) {
      // Don't let a sweep failure crash the @Cron runtime — next tick
      // retries on its own. Error lands in Sentry via the global Pino
      // pipeline (logger.constants REDACT_PATHS already redacts sensitive
      // 2FA fields per Step 2.10).
      this.logger.error(`Stale-pending reaper run failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Public for unit + integration tests. Idempotent: subsequent runs over
   * the same DB state are no-ops (`SELECT FOR UPDATE` returns 0 rows once
   * the previous run committed). Returns the summary the cron logs.
   */
  async reap(): Promise<{ users: number; tenants: number }> {
    return await this.db.systemTransaction(async (client: PoolClient) => {
      const stale = await this.findStaleUsers(client);
      if (stale.length === 0) {
        return { users: 0, tenants: 0 };
      }

      const outcomes = await this.cleanupBatch(client, stale);
      await this.writeAuditRows(client, outcomes);

      const tenantsDeleted = outcomes.filter(
        (o: CleanupOutcome): boolean => o.viaCascade && o.subdomain !== null,
      ).length;
      // Soft-deleted users (defensive edge case) count as users with viaCascade=false.
      return { users: outcomes.length, tenants: tenantsDeleted };
    });
  }

  /**
   * SELECT-FOR-UPDATE pinpoints the rows we'll act on and locks them for
   * the rest of the transaction. Single-replica today (V1) — the lock is
   * cheap insurance for a future scale-out without code change.
   */
  private async findStaleUsers(client: PoolClient): Promise<StaleUserRow[]> {
    const result = await client.query<StaleUserRow>(
      `SELECT id, tenant_id
         FROM users
        WHERE is_active = $1
          AND tfa_enrolled_at IS NULL
          AND created_at < NOW() - INTERVAL '1 hour'
        FOR UPDATE`,
      [IS_ACTIVE.INACTIVE],
    );
    return result.rows;
  }

  /**
   * Group stale users by tenant, then per-tenant decide cascade-delete vs
   * soft-delete. Each branch lives in its own helper so this orchestrator
   * stays under the cognitive-complexity-10 ceiling.
   */
  private async cleanupBatch(
    client: PoolClient,
    stale: readonly StaleUserRow[],
  ): Promise<CleanupOutcome[]> {
    const tenantIds = [...new Set(stale.map((u: StaleUserRow): number => u.tenant_id))];
    const userCountByTenant = await this.countUsersOnTenants(client, tenantIds);
    const staleByTenant = this.groupByTenant(stale);

    const outcomes: CleanupOutcome[] = [];
    for (const [tenantId, users] of staleByTenant) {
      const totalOnTenant = userCountByTenant.get(tenantId) ?? 0;
      const allStale = totalOnTenant === users.length;
      const partial =
        allStale ?
          await this.dropTenantCascade(client, tenantId, users)
        : await this.softDeleteEachUser(client, tenantId, users);
      outcomes.push(...partial);
    }
    return outcomes;
  }

  private groupByTenant(stale: readonly StaleUserRow[]): Map<number, StaleUserRow[]> {
    const map = new Map<number, StaleUserRow[]>();
    for (const user of stale) {
      const list = map.get(user.tenant_id) ?? [];
      list.push(user);
      map.set(user.tenant_id, list);
    }
    return map;
  }

  /**
   * Whole-tenant cleanup: drop the tenant. Architecturally relies on
   * `users.tenant_id ON DELETE CASCADE` to clear the abandoned user row
   * in the same statement, so this method writes only `DELETE FROM
   * tenants` and stays within `architectural.test.ts:291` (no
   * `DELETE FROM users`).
   *
   * FK CASCADE shipped 2026-05-01 via node-pg-migrate
   * `20260501012903758_flip-fk-users-tenant-on-delete-cascade`
   * (masterplan §Spec Deviations D4). This branch is correct
   * end-to-end and the §0.4 / DD-14 anti-subdomain-squatting
   * guarantee is restored.
   */
  private async dropTenantCascade(
    client: PoolClient,
    tenantId: number,
    users: readonly StaleUserRow[],
  ): Promise<CleanupOutcome[]> {
    const result = await client.query<{ subdomain: string }>(
      `DELETE FROM tenants WHERE id = $1 RETURNING subdomain`,
      [tenantId],
    );
    const subdomain = result.rows[0]?.subdomain ?? null;
    return users.map(
      (u: StaleUserRow): CleanupOutcome => ({
        userId: u.id,
        tenantId,
        subdomain,
        viaCascade: true,
      }),
    );
  }

  /**
   * Defensive edge case: tenant has at least one non-stale user (cannot
   * happen for a fresh signup but cheap insurance). Soft-delete the
   * stale users in place — UPDATE matches `users.service.ts:512`.
   */
  private async softDeleteEachUser(
    client: PoolClient,
    tenantId: number,
    users: readonly StaleUserRow[],
  ): Promise<CleanupOutcome[]> {
    const outcomes: CleanupOutcome[] = [];
    for (const user of users) {
      await client.query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [
        IS_ACTIVE.DELETED,
        user.id,
      ]);
      outcomes.push({ userId: user.id, tenantId, subdomain: null, viaCascade: false });
    }
    return outcomes;
  }

  private async countUsersOnTenants(
    client: PoolClient,
    tenantIds: readonly number[],
  ): Promise<Map<number, number>> {
    if (tenantIds.length === 0) return new Map();
    const result = await client.query<TenantUserCountRow>(
      `SELECT tenant_id, COUNT(*)::int AS cnt
         FROM users
        WHERE tenant_id = ANY($1::int[])
        GROUP BY tenant_id`,
      [tenantIds],
    );
    return new Map(
      result.rows.map((r: TenantUserCountRow): readonly [number, number] => [r.tenant_id, r.cnt]),
    );
  }

  /**
   * One audit_trail row per cleaned-up user. tenant_id references the
   * tenant that owned the user; in the soft-delete branch the tenant
   * still exists, in the `dropTenantCascade` branch the tenant has
   * already been cascaded away (FK migration 2026-05-01, §D4). The
   * audit_trail partition table has no FK to `tenants` (verified
   * `\d audit_trail` 2026-04-29) so the insert succeeds in either
   * branch. Inside the same transaction — if this fails, the whole
   * sweep rolls back (no orphan deletes without compliance evidence).
   *
   * Schema-correct §A8 tuple: `(action='delete', resource_type='2fa-stale-signup', …)`.
   */
  private async writeAuditRows(
    client: PoolClient,
    outcomes: readonly CleanupOutcome[],
  ): Promise<void> {
    if (outcomes.length === 0) return;
    const sql = `INSERT INTO audit_trail (
        tenant_id, user_id, user_name, user_role,
        action, resource_type, resource_id, resource_name,
        changes, ip_address, user_agent, status, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`;

    for (const outcome of outcomes) {
      const params = [
        outcome.tenantId,
        outcome.userId,
        null,
        null,
        'delete',
        '2fa-stale-signup',
        outcome.userId,
        null,
        JSON.stringify({
          userId: outcome.userId,
          tenantId: outcome.tenantId,
          subdomain: outcome.subdomain,
          tenantAlsoDeleted: outcome.viaCascade,
          reason: 'never-verified',
        }),
        null,
        null,
        'success',
        null,
      ];
      await client.query(sql, params);
    }
  }
}
