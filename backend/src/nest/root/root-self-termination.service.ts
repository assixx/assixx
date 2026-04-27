/**
 * Root Self-Termination Service — Layer 3 of the 4-layer Defense-in-Depth
 * model defined in `docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md` §Goal.
 *
 * Implements the peer-approval lifecycle: request → notify peers →
 * approve/reject → execute on approve. Companion to `RootProtectionService`
 * (Layer 2 — assertions wired into every user-mutating service) and the
 * database trigger `trg_root_protection` (Layer 4 — enforced at PG engine).
 *
 * Critical invariants enforced here:
 *   1. Self-termination is the ONLY legal path for a root to leave "active
 *      root" state. Direct mutations are blocked by Layer 2 + Layer 4.
 *   2. The approve flow is the ONLY caller that may set the
 *      `app.root_self_termination_approved` GUC the trigger looks for. The
 *      GUC is transaction-local (R9 mitigation) and is set ONLY AFTER the
 *      request row has been flipped to 'approved' — so Layer 4's
 *      row-existence verification (5-min window) finds a real approved row.
 *   3. 24h rejection cooldown (R3 + R7 mitigation) prevents re-request /
 *      notification storm against peer roots.
 *   4. `FOR UPDATE` on the request row + every active root row in the
 *      tenant during the approve TX (R1 mitigation): a concurrent peer
 *      demote / approve cannot race the post-lock recount.
 *
 * EventBus emits: `root.self-termination.requested|approved|rejected|expired`.
 * Until Step 2.7 registers handlers + typed methods, these events have no
 * listeners — the calls are no-ops by design (Phase 2.7 deliverable).
 *
 * Audit pattern: Each state transition writes a `root_logs` entry via
 * `ActivityLoggerService` (matches the dual-writer model documented in the
 * Phase 0 §0.5 audit). The HTTP-layer `AuditTrailInterceptor` additionally
 * records `audit_trail` rows automatically on success or thrown exceptions.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.4 (this Step)
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md (RLS, set_config)
 * @see backend/src/nest/root/root-protection.service.ts (Layer 2)
 * @see ADR-053 (planned, Phase 6)
 */
import type { UserRole } from '@assixx/shared';
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { eventBus } from '../../utils/event-bus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { RootProtectionService } from './root-protection.service.js';
import { RootSelfTerminationNotificationService } from './root-self-termination-notification.service.js';

/**
 * 24h cooldown after a rejection before the requester may submit a new
 * request (R3 / R7). Mirrored in the frontend tooltip (Step 5.1).
 */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Request lifetime — peer roots have 7 days to approve or reject before
 * the cron expires the request (Step 2.6 + masterplan §2.4 expireOldRequests).
 */
const REQUEST_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Stable error codes consumed by frontend (Phase 5) and API integration
 * tests (Phase 4). Keep in sync with §0.2 R-table additions.
 */
export const ROOT_SELF_TERMINATION_CODES = {
  COOLDOWN_ACTIVE: 'ROOT_REQUEST_COOLDOWN_ACTIVE',
  ALREADY_PENDING: 'ROOT_REQUEST_ALREADY_PENDING',
  NOT_FOUND: 'ROOT_REQUEST_NOT_FOUND',
  NOT_PENDING: 'ROOT_REQUEST_NOT_PENDING',
  EXPIRED: 'ROOT_REQUEST_EXPIRED',
  SELF_DECISION_FORBIDDEN: 'ROOT_REQUEST_NO_SELF_DECISION',
  REJECTION_REASON_REQUIRED: 'ROOT_REQUEST_REJECTION_REASON_REQUIRED',
  ROLE_FORBIDDEN: 'ROOT_REQUEST_ROLE_FORBIDDEN',
} as const;

/** DB-mapped status enum (mirrors `root_self_termination_status`). */
export type RootSelfTerminationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

/**
 * Acting user — resolved from `@CurrentUser()` at the controller boundary
 * (Step 2.5). Mirrors `RootProtectionService.ProtectionActor` but adds
 * `role` because §2.4 requires `assert(actor.role === 'root')` defense
 * even though `@Roles('root')` already gates the endpoints.
 */
export interface SelfTerminationActor {
  id: number;
  tenantId: number;
  role: UserRole;
}

/** Domain shape returned by service methods (camelCase, no DB leakage). */
export interface RootSelfTerminationRequest {
  id: string;
  tenantId: number;
  requesterId: number;
  reason: string | null;
  status: RootSelfTerminationStatus;
  expiresAt: Date;
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectedBy: number | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RequestRow {
  id: string;
  tenant_id: number;
  requester_id: number;
  reason: string | null;
  status: RootSelfTerminationStatus;
  expires_at: Date;
  approved_by: number | null;
  approved_at: Date | null;
  rejected_by: number | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function rowToDomain(row: RequestRow): RootSelfTerminationRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    requesterId: row.requester_id,
    reason: row.reason,
    status: row.status,
    expiresAt: row.expires_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class RootSelfTerminationService {
  private readonly logger = new Logger(RootSelfTerminationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly rootProtection: RootProtectionService,
    private readonly activityLogger: ActivityLoggerService,
    // Step 2.7 — notification fan-out (typed EventBus emits + persistent
    // INSERT rows). Called AFTER the producer's `tenantTransaction` commits
    // so notification failures cannot roll back business operations
    // (mirrors the vacation-notification.service.ts pattern).
    private readonly notification: RootSelfTerminationNotificationService,
  ) {}

  /**
   * Create a pending self-termination request for the acting root.
   *
   * Order of checks (each gates the next — fail fast):
   *  1. actor.role === 'root' (defense-in-depth; Roles guard already gates)
   *  2. 24h rejection cooldown (R3) — read most-recent rejection inside TX
   *  3. No existing pending row for this requester (DB unique partial index
   *     `idx_rstr_one_pending_per_requester` is the authoritative gate;
   *     this check produces a friendlier error before the index trips)
   *  4. Last-root protection — terminating the requester must leave ≥ 1
   *     other active root in the tenant (R1; uses FOR UPDATE inside TX)
   *  5. INSERT row (status='pending', expires_at=NOW()+7d), emit event,
   *     audit-log
   */
  async requestSelfTermination(
    actor: SelfTerminationActor,
    reason: string | null,
  ): Promise<RootSelfTerminationRequest> {
    this.assertActorIsRoot(actor);

    const created = await this.db.tenantTransaction<RootSelfTerminationRequest>(
      async (client: PoolClient) => {
        await this.assertCooldownPassed(client, actor.id);
        await this.assertNoPendingRequest(client, actor.id);
        await this.rootProtection.assertNotLastRoot(actor.tenantId, actor.id, client);

        const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * MS_PER_DAY);
        const insertResult = await client.query<RequestRow>(
          `INSERT INTO root_self_termination_requests
           (tenant_id, requester_id, reason, status, expires_at)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
          [actor.tenantId, actor.id, reason, expiresAt],
        );
        const row = insertResult.rows[0];
        if (row === undefined) {
          // Unreachable — INSERT ... RETURNING * always returns the inserted row.
          // Defensive only because tsconfig has noUncheckedIndexedAccess.
          throw new Error('INSERT returned no row');
        }

        await this.activityLogger.log({
          tenantId: actor.tenantId,
          userId: actor.id,
          action: 'create',
          entityType: 'user',
          entityId: actor.id,
          details: 'Root-Konto-Löschung beantragt (Self-Termination).',
          newValues: {
            request_id: row.id,
            expires_at: row.expires_at.toISOString(),
            reason: reason ?? null,
          },
        });

        this.logger.log(`Self-termination requested: requester=${actor.id} request=${row.id}`);
        return rowToDomain(row);
      },
    );

    // Step 2.7 — Notification fan-out happens AFTER the producer's TX
    // commits. The notification service has its own internal try/catch,
    // so a fan-out failure logs but does NOT propagate or roll back the
    // already-committed business state (mirrors vacation pattern).
    await this.notification.notifyRequested({
      tenantId: created.tenantId,
      requesterId: created.requesterId,
      requestId: created.id,
      expiresAt: created.expiresAt.toISOString(),
    });

    return created;
  }

  /**
   * Return the actor's currently pending request, or `null` when none
   * exists. Used by `/root-profile` (Step 5.1) to render the "Antrag
   * ausstehend" card with countdown.
   */
  async getMyPendingRequest(
    actor: SelfTerminationActor,
  ): Promise<RootSelfTerminationRequest | null> {
    this.assertActorIsRoot(actor);
    const row = await this.db.tenantQueryOne<RequestRow>(
      `SELECT * FROM root_self_termination_requests
       WHERE requester_id = $1 AND status = 'pending'
       LIMIT 1`,
      [actor.id],
    );
    return row === null ? null : rowToDomain(row);
  }

  /**
   * Return the actor's most recent rejected request, or `null`. Powers
   * the cooldown banner on `/root-profile` (Step 5.1) and the cooldown
   * gate inside `requestSelfTermination`. Public per masterplan §2.4
   * methods table — internal callers prefer the in-TX helper below.
   */
  async getMostRecentRejection(actorId: number): Promise<RootSelfTerminationRequest | null> {
    const row = await this.db.tenantQueryOne<RequestRow>(
      `SELECT * FROM root_self_termination_requests
       WHERE requester_id = $1 AND status = 'rejected'
       ORDER BY rejected_at DESC NULLS LAST
       LIMIT 1`,
      [actorId],
    );
    return row === null ? null : rowToDomain(row);
  }

  /**
   * Cancel the actor's own pending request — single UPDATE filtered by
   * `requester_id + status='pending'`, no users-table touch. Returns 404
   * when no pending row exists (idempotent withdraw / refresh races).
   */
  async cancelOwnRequest(actor: SelfTerminationActor): Promise<void> {
    this.assertActorIsRoot(actor);
    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      const result = await client.query<RequestRow>(
        `UPDATE root_self_termination_requests
         SET status = 'cancelled', updated_at = NOW()
         WHERE requester_id = $1 AND status = 'pending'
         RETURNING *`,
        [actor.id],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new NotFoundException({
          code: ROOT_SELF_TERMINATION_CODES.NOT_FOUND,
          message: 'Kein offener Antrag gefunden.',
        });
      }

      await this.activityLogger.log({
        tenantId: actor.tenantId,
        userId: actor.id,
        action: 'delete',
        entityType: 'user',
        entityId: actor.id,
        details: 'Root-Konto-Löschungsantrag zurückgezogen.',
        oldValues: { request_id: row.id, status: 'pending' },
        newValues: { status: 'cancelled' },
      });

      this.logger.log(`Self-termination cancelled: actor=${actor.id} request=${row.id}`);
    });
  }

  /**
   * List all pending peer requests visible to the actor (i.e. requests
   * where `requester_id != actor.id`). RLS already filters by tenant.
   * Excludes already-expired requests so the UI doesn't show stale rows
   * between cron sweeps.
   */
  async getPendingRequestsForApproval(
    actor: SelfTerminationActor,
  ): Promise<RootSelfTerminationRequest[]> {
    this.assertActorIsRoot(actor);
    const rows = await this.db.tenantQuery<RequestRow>(
      `SELECT * FROM root_self_termination_requests
       WHERE status = 'pending'
         AND requester_id <> $1
         AND expires_at > NOW()
       ORDER BY created_at ASC`,
      [actor.id],
    );
    return rows.map(rowToDomain);
  }

  /**
   * Approve a peer's pending request and execute the soft-delete in
   * a single atomic transaction. The TX ordering is critical (masterplan
   * §2.4) — Layer 4 trigger depends on the approved row existing BEFORE
   * the GUC is set + BEFORE the users update fires. See in-line comments.
   */
  async approveSelfTermination(
    actor: SelfTerminationActor,
    requestId: string,
    comment?: string,
  ): Promise<void> {
    this.assertActorIsRoot(actor);
    const approved = await this.db.tenantTransaction<RequestRow>(async (client: PoolClient) => {
      const request = await this.lockRequestForDecision(client, requestId);
      this.assertCanDecide(request, actor);
      if (request.expires_at.getTime() <= Date.now()) {
        throw new ConflictException({
          code: ROOT_SELF_TERMINATION_CODES.EXPIRED,
          message: 'Antrag ist abgelaufen.',
        });
      }
      // Lock all active roots in the tenant before the recount (R1).
      await client.query(
        `SELECT id FROM users
           WHERE tenant_id = $1 AND role = 'root' AND is_active = ${IS_ACTIVE.ACTIVE}
           FOR UPDATE`,
        [actor.tenantId],
      );
      await this.rootProtection.assertNotLastRoot(actor.tenantId, request.requester_id, client);
      // Step (4) — flip status FIRST so Layer 4 finds the row in its
      // 5-min approval window.
      await client.query(
        `UPDATE root_self_termination_requests
           SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
        [actor.id, request.id],
      );
      // Step (5) — set the trigger-bypass GUC AFTER the row exists.
      await client.query(`SELECT set_config('app.root_self_termination_approved', 'true', true)`);
      // Step (6) — execute the soft-delete. Trigger sees approved row +
      // GUC, allows. Last-root protection in trigger still enforced.
      await client.query(
        `UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
        [request.requester_id, actor.tenantId],
      );
      await this.auditApproval(actor, request, comment ?? null);
      return request;
    });

    // Step 2.7 — post-commit notification fan-out (see requestSelfTermination
    // for the rationale on out-of-TX placement).
    await this.notification.notifyApproved({
      tenantId: actor.tenantId,
      requesterId: approved.requester_id,
      requestId: approved.id,
      approverId: actor.id,
      comment: comment ?? null,
    });
  }

  /**
   * Reject a peer's pending request. Required `rejectionReason` (non-empty
   * after trim) — DTO will also enforce, this is the defense-in-depth check.
   * Sets status='rejected' + rejection metadata; users table is untouched.
   */
  async rejectSelfTermination(
    actor: SelfTerminationActor,
    requestId: string,
    rejectionReason: string,
  ): Promise<void> {
    this.assertActorIsRoot(actor);
    if (rejectionReason.trim() === '') {
      throw new ConflictException({
        code: ROOT_SELF_TERMINATION_CODES.REJECTION_REASON_REQUIRED,
        message: 'Begründung der Ablehnung ist erforderlich.',
      });
    }

    // Capture the TS-side rejection timestamp so the SQL row + the
    // notification cooldown computation use exactly the same value.
    // Avoids a milliseconds-scale drift between DB `NOW()` and the
    // Date object passed to `notifyRejected`.
    const rejectedAt = new Date();

    const rejected = await this.db.tenantTransaction<RequestRow>(async (client: PoolClient) => {
      const request = await this.lockRequestForDecision(client, requestId);
      this.assertCanDecide(request, actor);

      await client.query(
        `UPDATE root_self_termination_requests
           SET status = 'rejected',
               rejected_by = $1,
               rejected_at = $2,
               rejection_reason = $3,
               updated_at = NOW()
           WHERE id = $4`,
        [actor.id, rejectedAt, rejectionReason, request.id],
      );

      await this.activityLogger.log({
        tenantId: actor.tenantId,
        userId: actor.id,
        action: 'update',
        entityType: 'user',
        entityId: request.requester_id,
        details: `Root-Konto-Löschungsantrag abgelehnt (request=${request.id}).`,
        oldValues: { status: 'pending' },
        newValues: { status: 'rejected', rejection_reason: rejectionReason },
      });

      this.logger.log(
        `Self-termination rejected: rejector=${actor.id} requester=${request.requester_id} request=${request.id}`,
      );
      return request;
    });

    // Step 2.7 — post-commit notification fan-out.
    await this.notification.notifyRejected({
      tenantId: actor.tenantId,
      requesterId: rejected.requester_id,
      requestId: rejected.id,
      approverId: actor.id,
      rejectionReason,
      rejectedAt,
    });
  }

  /**
   * Mark all pending requests past `expires_at` as expired. Called by
   * `RootSelfTerminationCron` (Step 2.6) on a daily schedule. Uses
   * `systemQuery()` (sys_user, BYPASSRLS) because the cron is cross-tenant
   * — every tenant's stale rows are swept in one statement.
   *
   * Returns the number of rows expired so the cron can log a summary.
   */
  async expireOldRequests(): Promise<number> {
    const expired = await this.db.systemQuery<RequestRow>(
      `UPDATE root_self_termination_requests
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING *`,
    );

    for (const row of expired) {
      eventBus.emit('root.self-termination.expired', {
        tenantId: row.tenant_id,
        requestId: row.id,
        requesterId: row.requester_id,
      });
      // Audit per row — keeps a paper trail per requester for compliance.
      await this.activityLogger.log({
        tenantId: row.tenant_id,
        userId: row.requester_id,
        action: 'update',
        entityType: 'user',
        entityId: row.requester_id,
        details: `Root-Konto-Löschungsantrag abgelaufen (request=${row.id}).`,
        oldValues: { status: 'pending' },
        newValues: { status: 'expired' },
      });
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} root self-termination request(s)`);
    }
    return expired.length;
  }

  // ── private helpers ────────────────────────────────────────────────

  /**
   * Defense-in-depth: `@Roles('root')` already blocks non-roots at the
   * controller boundary — this assertion guards against direct service
   * usage from background jobs / future internal callers.
   */
  private assertActorIsRoot(actor: SelfTerminationActor): void {
    if (actor.role !== 'root') {
      throw new ForbiddenException({
        code: ROOT_SELF_TERMINATION_CODES.ROLE_FORBIDDEN,
        message: 'Nur Root-Benutzer können diese Aktion ausführen.',
      });
    }
  }

  /**
   * Throws `ConflictException(COOLDOWN_ACTIVE)` if the actor was rejected
   * within the last 24h. Reads inside the caller's TX so the cooldown
   * decision is consistent with the subsequent INSERT.
   */
  private async assertCooldownPassed(client: PoolClient, actorId: number): Promise<void> {
    const result = await client.query<RequestRow>(
      `SELECT * FROM root_self_termination_requests
       WHERE requester_id = $1 AND status = 'rejected'
       ORDER BY rejected_at DESC NULLS LAST
       LIMIT 1`,
      [actorId],
    );
    const last = result.rows[0];
    if (last === undefined) return;
    if (last.rejected_at === null) return;

    const cooldownEnd = new Date(last.rejected_at.getTime() + COOLDOWN_MS);
    if (Date.now() >= cooldownEnd.getTime()) return;

    throw new ConflictException({
      code: ROOT_SELF_TERMINATION_CODES.COOLDOWN_ACTIVE,
      message: `Re-request blocked until ${cooldownEnd.toISOString()} (24h cooldown after rejection).`,
      cooldownEndsAt: cooldownEnd.toISOString(),
    });
  }

  /**
   * Throws `ConflictException(ALREADY_PENDING)` if a pending row exists.
   * Friendlier than letting the DB unique partial index trip.
   */
  private async assertNoPendingRequest(client: PoolClient, actorId: number): Promise<void> {
    const result = await client.query<RequestRow>(
      `SELECT id FROM root_self_termination_requests
       WHERE requester_id = $1 AND status = 'pending'`,
      [actorId],
    );
    if (result.rows.length === 0) return;

    throw new ConflictException({
      code: ROOT_SELF_TERMINATION_CODES.ALREADY_PENDING,
      message: 'Es existiert bereits ein laufender Antrag.',
    });
  }

  /**
   * Lock a request row inside a transaction. RLS already filters by
   * tenant — a cross-tenant `requestId` returns 0 rows → 404, which is
   * indistinguishable from "doesn't exist" (defense against ID probing).
   */
  private async lockRequestForDecision(client: PoolClient, requestId: string): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `SELECT * FROM root_self_termination_requests
       WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    const request = result.rows[0];
    if (request === undefined) {
      throw new NotFoundException({
        code: ROOT_SELF_TERMINATION_CODES.NOT_FOUND,
        message: 'Antrag nicht gefunden.',
      });
    }
    return request;
  }

  /**
   * Shared precondition check for approve + reject:
   *   - status must be 'pending' (404 was already raised, so 409 here)
   *   - requester != actor (no self-decision; DB chk_no_self_approval is
   *     the authoritative backstop on approved rows)
   */
  private assertCanDecide(request: RequestRow, actor: SelfTerminationActor): void {
    if (request.status !== 'pending') {
      throw new ConflictException({
        code: ROOT_SELF_TERMINATION_CODES.NOT_PENDING,
        message: `Antrag ist bereits ${request.status}.`,
      });
    }
    if (request.requester_id === actor.id) {
      throw new ForbiddenException({
        code: ROOT_SELF_TERMINATION_CODES.SELF_DECISION_FORBIDDEN,
        message: 'Eigene Anträge können nicht durch Sie entschieden werden.',
      });
    }
  }

  /**
   * Audit-log + console-log for the approve flow. Extracted to keep
   * `approveSelfTermination` under the 60-line cap. Step 2.7 moved the
   * EventBus emit out — it now happens in `RootSelfTerminationNotificationService`
   * AFTER the producer's TX commits, so this helper retains only the
   * audit responsibilities.
   */
  private async auditApproval(
    actor: SelfTerminationActor,
    request: RequestRow,
    comment: string | null,
  ): Promise<void> {
    await this.activityLogger.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'delete',
      entityType: 'user',
      entityId: request.requester_id,
      details: `Root-Konto-Löschungsantrag genehmigt (request=${request.id}).`,
      oldValues: {
        request_id: request.id,
        requester_id: request.requester_id,
        approver_comment: comment,
      },
      newValues: { is_active: IS_ACTIVE.DELETED },
    });

    this.logger.log(
      `Self-termination approved: approver=${actor.id} requester=${request.requester_id} request=${request.id}`,
    );
  }
}
