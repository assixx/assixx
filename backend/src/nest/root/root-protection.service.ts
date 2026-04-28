/**
 * Root Account Protection Service — Layer 2 of the 4-layer Defense-in-Depth
 * model defined in `docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md` §Goal.
 *
 * Pure application-level guard logic for the four operations that take a
 * root account out of "active root" state (soft-delete, deactivate, demote,
 * hard-delete). Wired into every service / PUT route that mutates
 * `users.is_active` or `users.role` (Step 2.3, Session 4 — pending).
 *
 * Contract:
 *   - assertCrossRootTerminationForbidden — throws ForbiddenException
 *     when actor != target AND target.role === 'root'.
 *   - assertNotLastRoot — throws PreconditionFailedException when removing
 *     the target would leave 0 active roots in the tenant.
 *   - Both assertions audit-log the denial via ActivityLoggerService BEFORE
 *     throwing, so an attempted bypass downstream still leaves a trace.
 *
 * Why throws instead of booleans: a guard that is silently bypassed by a
 * forgotten call site is not a guard. Forcing exceptions makes "did the
 * caller wire it up?" a hard, reviewable signal — the same reasoning that
 * underpins ADR-019's strict-RLS-default decision.
 *
 * Why no ClsService injection: actor identity is passed in by the controller
 * (resolved via `@CurrentUser()` per ADR-005), not pulled from CLS here.
 * Keeps the service deterministic and testable without CLS context.
 *
 * Layer 1 (Frontend, UX hint), Layer 3 (RootSelfTerminationService — peer
 * approval), and Layer 4 (DB trigger `trg_root_protection`, Phase 1 §1.2)
 * are independent — this service does NOT enforce them.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.2 (this Step)
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md (DB pool choice)
 * @see ADR-053 (planned, Phase 6)
 */
import type { UserRole } from '@assixx/shared';
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ForbiddenException,
  Injectable,
  Logger,
  PreconditionFailedException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * Operations that take a root account out of "active root" state.
 * Mirrors the four rows in §Operations Covered in the masterplan.
 */
export type TerminationOp = 'soft-delete' | 'deactivate' | 'demote' | 'hard-delete';

/**
 * Acting user (the one performing the mutation). Resolved from
 * `@CurrentUser()` at controller boundary — only id + tenantId are needed
 * here, so we keep the surface minimal to avoid coupling to NestAuthUser.
 */
export interface ProtectionActor {
  id: number;
  tenantId: number;
}

/**
 * Target user — the row being mutated. Callers map their DB row /
 * domain object to this shape. `isActive` is camelCase to keep the
 * service free of snake_case in code; the DB column stays `is_active`.
 *
 * `isActive` is optional because hard-delete callers may have only
 * the role+id at hand; for soft-delete/deactivate/demote it is
 * required for `isTerminationOp` to detect a true state transition.
 */
export interface ProtectionTargetUser {
  id: number;
  tenantId: number;
  role: UserRole;
  isActive?: number;
}

/**
 * Stable error codes consumed by the frontend (and by API integration
 * tests in Phase 4). Keep in sync with §0.2 R-table and any frontend
 * mapping table introduced in Phase 5.
 */
export const ROOT_PROTECTION_CODES = {
  CROSS_ROOT_FORBIDDEN: 'ROOT_CROSS_TERMINATION_FORBIDDEN',
  SELF_VIA_APPROVAL_REQUIRED: 'ROOT_SELF_TERMINATION_VIA_APPROVAL_REQUIRED',
  LAST_ROOT: 'ROOT_LAST_ROOT_PROTECTION',
} as const;

interface CountRow {
  // PG `COUNT(*)` returns BIGINT, which the `pg` driver surfaces as a string.
  count: string;
}

@Injectable()
export class RootProtectionService {
  private readonly logger = new Logger(RootProtectionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Throws `ForbiddenException` when an actor attempts to terminate a
   * different root user. Audit-logs the denial first so the trace exists
   * even when the caller swallows the exception.
   *
   * Caller contract: only invoke when the operation IS a termination.
   * Use {@link isTerminationOp} to gate the call site (see masterplan
   * §2.3 wiring pattern).
   *
   * Async because the audit write is awaited — if you forget `await`,
   * TypeScript's `no-floating-promises` rule will surface the bug.
   */
  async assertCrossRootTerminationForbidden(
    actor: ProtectionActor,
    target: ProtectionTargetUser,
    op: TerminationOp,
  ): Promise<void> {
    if (target.role !== 'root') return;
    if (actor.id === target.id) return;

    const reason = `Cross-root ${op} blocked: actor=${actor.id} target=${target.id}`;
    await this.auditDeniedAttempt(actor, target, op, reason);

    throw new ForbiddenException({
      code: ROOT_PROTECTION_CODES.CROSS_ROOT_FORBIDDEN,
      message: 'Andere Root-Konten können nicht durch Sie geändert werden.',
    });
  }

  /**
   * Throws `PreconditionFailedException` when terminating `excludingUserId`
   * would leave the tenant with zero active root accounts.
   *
   * If `client` is provided, the count runs `FOR UPDATE` inside the caller's
   * transaction — used by the approve flow (Step 2.4, Session 5 — pending)
   * to mitigate R1 (parallel approve + concurrent demote race window).
   * Without `client`, the count uses the system pool (sys_user, BYPASSRLS),
   * matching the existing pattern at root.service.ts:364.
   */
  async assertNotLastRoot(
    tenantId: number,
    excludingUserId: number,
    client?: PoolClient,
  ): Promise<void> {
    const count = await this.countActiveRoots(tenantId, excludingUserId, client);
    if (count > 0) return;

    throw new PreconditionFailedException({
      code: ROOT_PROTECTION_CODES.LAST_ROOT,
      message: 'Letzter aktiver Root-Account — Termination blockiert.',
    });
  }

  /**
   * Returns the number of active root users in the tenant, optionally
   * excluding one user ID. With `client` participates in the caller's
   * transaction and locks the matching rows `FOR UPDATE` — this is the
   * R1 mitigation: a concurrent demote of a peer root will block on the
   * lock and re-evaluate against the post-commit state.
   *
   * Without `client` uses the system pool (BYPASSRLS) — safe because the
   * WHERE clause is explicit on `tenant_id`, and the count must be
   * authoritative across the connection-state-free read.
   */
  async countActiveRoots(
    tenantId: number,
    excludingUserId?: number,
    client?: PoolClient,
  ): Promise<number> {
    const includeExclusion = excludingUserId !== undefined;
    const params = includeExclusion ? [tenantId, excludingUserId] : [tenantId];

    if (client !== undefined) {
      // Phase 4 / Session 8 — discovered live: PostgreSQL forbids
      // `SELECT COUNT(*) ... FOR UPDATE` ("FOR UPDATE is not allowed with
      // aggregate functions"). The R1 mitigation requires locking the
      // matching rows so concurrent demotes block on commit; we project
      // `id` per row instead and use `result.rows.length` as the count.
      // Functionally equivalent to the masterplan §2.4 approve-TX shape
      // (`SELECT id ... FOR UPDATE` then recount).
      const lockSql =
        includeExclusion ?
          `SELECT id FROM users
           WHERE tenant_id = $1 AND role = 'root'
             AND is_active = ${IS_ACTIVE.ACTIVE} AND id <> $2
           FOR UPDATE`
        : `SELECT id FROM users
           WHERE tenant_id = $1 AND role = 'root'
             AND is_active = ${IS_ACTIVE.ACTIVE}
           FOR UPDATE`;
      const result = await client.query<{ id: number }>(lockSql, params);
      return result.rows.length;
    }

    // No-client path: BYPASSRLS system pool, COUNT(*) is fine — no lock needed.
    const countSql =
      includeExclusion ?
        `SELECT COUNT(*) AS count FROM users
         WHERE tenant_id = $1 AND role = 'root'
           AND is_active = ${IS_ACTIVE.ACTIVE} AND id <> $2`
      : `SELECT COUNT(*) AS count FROM users
         WHERE tenant_id = $1 AND role = 'root'
           AND is_active = ${IS_ACTIVE.ACTIVE}`;
    const rows = await this.db.systemQuery<CountRow>(countSql, params);
    return Number(rows[0]?.count ?? '0');
  }

  /**
   * Pure helper — true when a mutation transitions a root user out of
   * "active root" state per §Operations Covered:
   *
   *   soft-delete: is_active 1 → 4
   *   deactivate:  is_active 1 → 0
   *   demote:      role 'root' → !'root'
   *   hard-delete: row removed (`after === null`)
   *
   * Returns false when `before.role !== 'root'` regardless of `op` —
   * non-root targets are never under root protection.
   *
   * Callers use this as the gate before invoking the cross-root assertion
   * (see masterplan §2.3 wiring pattern).
   */
  isTerminationOp(
    before: ProtectionTargetUser,
    after: ProtectionTargetUser | null,
    op: TerminationOp,
  ): boolean {
    if (before.role !== 'root') return false;

    switch (op) {
      case 'hard-delete':
        return after === null;
      case 'soft-delete':
        return (
          after !== null &&
          before.isActive === IS_ACTIVE.ACTIVE &&
          after.isActive === IS_ACTIVE.DELETED
        );
      case 'deactivate':
        return (
          after !== null &&
          before.isActive === IS_ACTIVE.ACTIVE &&
          after.isActive === IS_ACTIVE.INACTIVE
        );
      case 'demote':
        return after !== null && after.role !== 'root';
    }
  }

  /**
   * Writes a denial entry to `root_logs` via ActivityLoggerService.
   * Action is mapped from the attempted operation: hard/soft-delete →
   * 'delete', deactivate/demote → 'update'. The denial is encoded in
   * `details` (German, dashboard-visible) and structured under
   * `oldValues` for machine-readable filtering.
   *
   * Public so other layers (e.g. the approve flow when it rejects on
   * post-lock recount) can reuse the same audit shape. Underlying
   * service is fire-and-forget — never throws, never blocks.
   *
   * Note: the AuditTrailInterceptor will additionally record the failed
   * HTTP request in `audit_trail` automatically when the assertion
   * throws — so a single denial produces TWO entries (root_logs +
   * audit_trail). Intentional — different consumers, different retention.
   */
  async auditDeniedAttempt(
    actor: ProtectionActor,
    target: ProtectionTargetUser,
    op: TerminationOp,
    reason: string,
  ): Promise<void> {
    const action = op === 'hard-delete' || op === 'soft-delete' ? 'delete' : 'update';

    this.logger.warn(
      `Root protection DENIED: actor=${actor.id} target=${target.id} op=${op} reason=${reason}`,
    );

    await this.activityLogger.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action,
      entityType: 'user',
      entityId: target.id,
      details: `Root-Konto-Termination ABGELEHNT (${op}): ${reason}`,
      oldValues: {
        target_role: target.role,
        target_is_active: target.isActive ?? null,
        termination_op: op,
        denial_reason: reason,
      },
    });
  }
}
