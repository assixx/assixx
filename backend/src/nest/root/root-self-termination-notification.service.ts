/**
 * Root Self-Termination Notification Service — Step 2.7 of
 * FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md.
 *
 * Owns notification fan-out for the 3 user-facing self-termination
 * lifecycle events:
 *   - Requested → peer roots (requester excluded)
 *   - Approved  → requester + peer roots (approver excluded — they
 *                 performed the action)
 *   - Rejected  → requester only (with reason + 24h cooldown timestamp)
 *
 * Each method does TWO things, in order:
 *   1. Synchronous typed `eventBus.emit*()` — immediate SSE delivery to
 *      connected clients (ADR-003)
 *   2. Persistent `INSERT INTO notifications` rows for sidebar badge
 *      counts and unread tracking (ADR-004)
 *
 * Public methods are wrapped in a top-level try/catch that NEVER throws
 * — notification is secondary to the business operation. The producer
 * (`RootSelfTerminationService`) calls these methods AFTER the business
 * `tenantTransaction` commits, with `void` (fire-and-forget) so HTTP
 * latency is unaffected by the fan-out.
 *
 * § Spec Deviation D7 (masterplan §2.7):
 * The masterplan literal-text says "modify `notifications.service.ts`
 * — handlers fan out to all OTHER active roots in tenant". The actual
 * implementation lives in this domain-specific service co-located with
 * the producer, following the established repo convention:
 *   - `vacation/vacation-notification.service.ts`
 *   - `work-orders/work-orders-notification.service.ts`
 *   - `tpm/tpm-notification.service.ts`
 * `notifications.service.ts` is intentionally domain-agnostic (CRUD
 * only) — concentrating per-domain handler logic there would create a
 * god object that knows about every feature. This deviation is a "where
 * the handlers live" clarification, NOT a behavioral change vs. §2.7.
 *
 * Recipient resolution uses `tenantQuery` / `tenantQueryOne` (RLS-
 * filtered via CLS context). The producer always calls from inside an
 * authenticated HTTP request handler, so cross-tenant leakage is
 * structurally impossible (ADR-019).
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.7
 * @see docs/infrastructure/adr/ADR-003-notification-system.md (SSE)
 * @see docs/infrastructure/adr/ADR-004-persistent-notification-counts.md
 * @see backend/src/nest/vacation/vacation-notification.service.ts (gold-standard sibling)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * 24h cooldown after rejection (mirrors `RootSelfTerminationService.COOLDOWN_MS`
 * — duplicated rather than imported to avoid producer→notification cyclic dep).
 * Single source of truth for the value lives in the masterplan §0.2 R3 / R7.
 */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Persistent-row notification `type` discriminator (free-form VARCHAR(50)). */
const NOTIFICATION_TYPE = 'root_self_termination';

interface UserNameRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

interface UserIdRow {
  id: number;
}

@Injectable()
export class RootSelfTerminationNotificationService {
  private readonly logger = new Logger(RootSelfTerminationNotificationService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Notify peer roots that a new self-termination request was created.
   * Recipients: every active root in the tenant EXCEPT the requester.
   * Priority `high` because peer roots have a 7-day TTL to act.
   */
  async notifyRequested(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    expiresAt: string; // ISO 8601
  }): Promise<void> {
    try {
      const requesterName = await this.resolveUserName(params.requesterId);
      const peers = await this.findPeerRoots(params.tenantId, [params.requesterId]);

      eventBus.emitRootSelfTerminationRequested(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.expiresAt,
      );

      const message = `${requesterName} möchte sein/ihr Root-Konto löschen. Genehmigung erforderlich.`;
      for (const peer of peers) {
        await this.insertPersistentNotification({
          tenantId: params.tenantId,
          recipientId: peer.id,
          title: 'Root-Konto-Löschung beantragt',
          message,
          priority: 'high',
          createdBy: params.requesterId,
          requestId: params.requestId,
          actionUrl: '/manage-approvals',
          actionLabel: 'Antrag prüfen',
        });
      }
    } catch (error: unknown) {
      this.logger.error(`notifyRequested fan-out failed: ${String(error)}`);
    }
  }

  /**
   * Notify the just-terminated requester + active peer roots that the
   * self-termination was approved + executed. Approver is excluded
   * (they performed the action themselves and have implicit context).
   * The requester row already has `is_active=4` by this point — the
   * persistent INSERT still happens for compliance trail (FK on
   * `notifications.recipient_id` does not exist, so no constraint
   * violation).
   */
  async notifyApproved(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    approverId: number;
    comment: string | null;
  }): Promise<void> {
    try {
      const requesterName = await this.resolveUserName(params.requesterId);
      const approverName = await this.resolveUserName(params.approverId);
      // Active peers excluding both approver and requester (the latter
      // is is_active=4 by now anyway — but explicit filter is defensive).
      const peers = await this.findPeerRoots(params.tenantId, [
        params.approverId,
        params.requesterId,
      ]);

      eventBus.emitRootSelfTerminationApproved(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.approverId,
        approverName,
        params.comment,
      );

      const message = `Konto von ${requesterName} wurde gelöscht (genehmigt von ${approverName}).`;
      const recipientIds = [params.requesterId, ...peers.map((p: UserIdRow) => p.id)];

      for (const recipientId of recipientIds) {
        await this.insertPersistentNotification({
          tenantId: params.tenantId,
          recipientId,
          title: 'Root-Konto-Löschung genehmigt',
          message,
          priority: 'normal',
          createdBy: params.approverId,
          requestId: params.requestId,
          actionUrl: '/manage-approvals',
          actionLabel: 'Details ansehen',
        });
      }
    } catch (error: unknown) {
      this.logger.error(`notifyApproved fan-out failed: ${String(error)}`);
    }
  }

  /**
   * Notify the requester that their request was rejected. Single
   * recipient — the rejector already has the context, peer roots are
   * not involved in this notification per §2.7. Body includes the
   * rejection reason + cooldown end (24h after `rejectedAt`) so the
   * requester knows when re-request becomes eligible.
   */
  async notifyRejected(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    approverId: number;
    rejectionReason: string;
    rejectedAt: Date;
  }): Promise<void> {
    try {
      const requesterName = await this.resolveUserName(params.requesterId);
      const approverName = await this.resolveUserName(params.approverId);
      const cooldownEndsAt = new Date(params.rejectedAt.getTime() + COOLDOWN_MS).toISOString();

      eventBus.emitRootSelfTerminationRejected(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.approverId,
        approverName,
        params.rejectionReason,
        cooldownEndsAt,
      );

      await this.insertPersistentNotification({
        tenantId: params.tenantId,
        recipientId: params.requesterId,
        title: 'Root-Konto-Löschung abgelehnt',
        message: `Antrag wurde abgelehnt. Grund: ${params.rejectionReason}. Erneuter Antrag in 24h möglich.`,
        priority: 'normal',
        createdBy: params.approverId,
        requestId: params.requestId,
        actionUrl: '/root-profile',
        actionLabel: 'Profil ansehen',
      });
    } catch (error: unknown) {
      this.logger.error(`notifyRejected fan-out failed: ${String(error)}`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Resolve a user's display name to "First Last", falling back to
   * "Benutzer #<id>" when the row is missing (e.g., already hard-deleted)
   * or when both name parts are null/empty. Defensive — notifications
   * must work for soft-deleted (is_active=4) users for the compliance
   * trail.
   */
  private async resolveUserName(userId: number): Promise<string> {
    const row = await this.db.tenantQueryOne<UserNameRow>(
      `SELECT id, first_name, last_name FROM users WHERE id = $1`,
      [userId],
    );
    if (row === null) return `Benutzer #${userId}`;
    const first = row.first_name?.trim() ?? '';
    const last = row.last_name?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full === '' ? `Benutzer #${userId}` : full;
  }

  /**
   * Return all active root users in the tenant excluding the given IDs.
   * RLS filters by tenant via the CLS-set `app.tenant_id` GUC; the
   * `tenant_id = $1` predicate is defensive (matches the RLS filter).
   * The IN-clause is built from a small, caller-controlled integer list
   * (≤2 entries today) — no SQL injection surface.
   */
  private async findPeerRoots(
    tenantId: number,
    excludeIds: readonly number[],
  ): Promise<UserIdRow[]> {
    if (excludeIds.length === 0) {
      return await this.db.tenantQuery<UserIdRow>(
        `SELECT id FROM users
         WHERE tenant_id = $1 AND role = 'root' AND is_active = $2`,
        [tenantId, IS_ACTIVE.ACTIVE],
      );
    }
    const placeholders = excludeIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
    return await this.db.tenantQuery<UserIdRow>(
      `SELECT id FROM users
       WHERE tenant_id = $1 AND role = 'root' AND is_active = $2
         AND id NOT IN (${placeholders})`,
      [tenantId, IS_ACTIVE.ACTIVE, ...excludeIds],
    );
  }

  /**
   * Persistent INSERT for the `notifications` table (ADR-004 sidebar
   * counts + read tracking). Errors logged but never thrown — the
   * top-level try/catch in each public method is the actual safety net,
   * but this inner catch makes the per-row failure mode explicit so a
   * single bad recipient does not abort the whole fan-out loop.
   */
  private async insertPersistentNotification(params: {
    tenantId: number;
    recipientId: number;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdBy: number;
    requestId: string;
    actionUrl: string;
    actionLabel: string;
  }): Promise<void> {
    try {
      const notificationUuid = uuidv7();
      await this.db.tenantQuery(
        `INSERT INTO notifications (
          tenant_id, type, title, message, priority,
          recipient_type, recipient_id, action_url, action_label,
          metadata, created_by, uuid, uuid_created_at
        ) VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $8, $9, $10, $11, NOW())`,
        [
          params.tenantId,
          NOTIFICATION_TYPE,
          params.title,
          params.message,
          params.priority,
          params.recipientId,
          params.actionUrl,
          params.actionLabel,
          JSON.stringify({ requestId: params.requestId }),
          params.createdBy,
          notificationUuid,
        ],
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to insert root_self_termination notification (recipient=${params.recipientId}): ${String(error)}`,
      );
    }
  }
}
