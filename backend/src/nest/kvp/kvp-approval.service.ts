/**
 * KVP Approval Sub-Service
 *
 * Bridge between KVP module and the Approvals system (ADR-037).
 * Handles: request approval, sync decisions, startup reconciliation.
 *
 * Called by KvpController — never directly by external modules.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';

import { eventBus } from '../../utils/event-bus.js';
import { ApprovalsConfigService } from '../approvals/approvals-config.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import type { Approval } from '../approvals/approvals.types.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ERROR_SUGGESTION_NOT_FOUND } from './kvp.constants.js';
import { isUuid } from './kvp.helpers.js';

// =============================================================================
// TYPES
// =============================================================================

interface KvpSuggestionStub {
  id: number;
  uuid: string;
  title: string;
  status: string;
  submitted_by: number;
}

interface ApprovalDecisionPayload {
  uuid: string;
  title: string;
  addonCode: string;
  status: string;
  requestedByName: string;
  decidedByName?: string;
  decisionNote?: string | null;
}

interface ApprovalRow {
  uuid: string;
  source_uuid: string;
  status: string;
  decision_note: string | null;
}

/**
 * Compose a human display name from the (nullable) `first_name` /
 * `last_name` columns of `users`, falling back through email and finally
 * a placeholder. Used by `getApprovalMastersForRequester` for the KVP
 * info banner — keeping the fallback order explicit so the UI never
 * shows blanks.
 */
function buildDisplayName(row: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const first = row.first_name?.trim() ?? '';
  const last = row.last_name?.trim() ?? '';
  if (first !== '' && last !== '') return `${first} ${last}`;
  if (first !== '') return first;
  if (last !== '') return last;
  if (row.email.trim() !== '') return row.email;
  return 'Unbekannt';
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class KvpApprovalService implements OnModuleInit {
  private readonly logger = new Logger(KvpApprovalService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly approvalsService: ApprovalsService,
    private readonly approvalsConfigService: ApprovalsConfigService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.subscribeToApprovalDecisions();
  }

  async onModuleInit(): Promise<void> {
    await this.reconcilePendingApprovals();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /** Request approval from configured KVP masters */
  async requestApproval(
    tenantId: number,
    idOrUuid: number | string,
    requestedBy: number,
  ): Promise<Approval> {
    const suggestion = await this.findSuggestion(tenantId, idOrUuid);

    this.assertStatusAllowsApproval(suggestion.status);
    await this.assertNoExistingApproval(tenantId, suggestion.uuid);

    const approval = await this.approvalsService.create(
      {
        addonCode: 'kvp',
        sourceEntityType: 'kvp_suggestion',
        sourceUuid: suggestion.uuid.trim(),
        title: suggestion.title,
        priority: 'medium',
      },
      tenantId,
      requestedBy,
    );

    await this.updateSuggestionStatus(tenantId, suggestion.uuid, 'in_review');
    await this.createRequestNotifications(tenantId, suggestion, requestedBy);

    this.logger.log(`Approval requested for KVP ${suggestion.uuid} by user ${String(requestedBy)}`);

    return approval;
  }

  /** Fetch the approval linked to a KVP suggestion (if any) */
  async getApprovalForSuggestion(
    tenantId: number,
    idOrUuid: number | string,
  ): Promise<Approval | null> {
    const suggestion = await this.findSuggestion(tenantId, idOrUuid);

    const rows = await this.db.tenantQuery<ApprovalRow>(
      `SELECT uuid, source_uuid, status, decision_note
       FROM approvals
       WHERE addon_code = 'kvp'
         AND source_uuid = $1
         AND tenant_id = $2
         AND is_active = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [suggestion.uuid.trim(), tenantId, IS_ACTIVE.ACTIVE],
    );

    const row = rows[0];
    if (row === undefined) {
      return null;
    }

    return await this.approvalsService.findById(row.uuid.trim());
  }

  /** Check if any approval master is configured for addon 'kvp' (tenant-wide) */
  async hasApprovalConfig(tenantId: number): Promise<boolean> {
    const rows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM approval_configs
       WHERE addon_code = 'kvp'
         AND tenant_id = $1
         AND is_active = $2`,
      [tenantId, IS_ACTIVE.ACTIVE],
    );

    return Number(rows[0]?.count ?? '0') > 0;
  }

  /**
   * Check if a KVP approval master is reachable for the requester's
   * organizational scope (area/department/team).
   *
   * Backs the Hard-Gate in `KvpService.createSuggestion()` and the per-user
   * branch of `GET /kvp/approval-config-status` (Masterplan §3.4 v0.6.0,
   * ADR-037 Hard-Gate Amendment 2026-04-26). Why scope-aware instead of
   * tenant-wide: a tenant might have configured a master for Area 1 only —
   * a user in Area 2 must still be blocked, even though `hasApprovalConfig`
   * returns true.
   *
   * Delegates to `ApprovalsConfigService.resolveApprovers('kvp', userId)`,
   * which already implements the scope resolution via the `requester_org`
   * CTE (ADR-037 Org-Scope Amendment 2026-03-23).
   */
  async canRequesterFindApprovalMaster(userId: number): Promise<boolean> {
    const approvers = await this.approvalsConfigService.resolveApprovers('kvp', userId);
    return approvers.length > 0;
  }

  /**
   * Resolve the KVP approval masters for the requester and return display
   * names so the frontend can show an info banner ("Dein KVP-Master: …").
   *
   * The display name falls back through `first_name last_name` →
   * `first_name` → `last_name` → `email` → `'Unbekannt'`, since
   * `users.first_name` and `users.last_name` are both nullable. RLS on
   * `users` (ADR-019) restricts to the current tenant — `resolveApprovers`
   * already pre-filtered to in-tenant IDs, so the JOIN is a no-op for
   * cross-tenant safety but kept for defense in depth.
   */
  async getApprovalMastersForRequester(
    userId: number,
  ): Promise<{ id: number; displayName: string }[]> {
    const approverIds = await this.approvalsConfigService.resolveApprovers('kvp', userId);
    if (approverIds.length === 0) return [];

    interface MasterRow {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
    }
    const rows = await this.db.tenantQuery<MasterRow>(
      `SELECT id, first_name, last_name, email
         FROM users
        WHERE id = ANY($1::int[])
        ORDER BY last_name NULLS LAST, first_name NULLS LAST, email`,
      [approverIds],
    );

    return rows.map((r: MasterRow) => ({
      id: r.id,
      displayName: buildDisplayName(r),
    }));
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  private subscribeToApprovalDecisions(): void {
    eventBus.on(
      'approval.decided',
      (data: {
        tenantId: number;
        approval: ApprovalDecisionPayload;
        requestedByUserId: number;
        decidedByUserId?: number;
      }) => {
        if (data.approval.addonCode === 'kvp') {
          void this.handleApprovalDecision(
            data.tenantId,
            data.approval,
            data.requestedByUserId,
            data.decidedByUserId ?? 0,
          );
        }
      },
    );
  }

  /** Sync KVP status when approval master decides */
  private async handleApprovalDecision(
    tenantId: number,
    approvalData: ApprovalDecisionPayload,
    requestedByUserId: number,
    decidedByUserId: number,
  ): Promise<void> {
    try {
      const sourceUuid = await this.getSourceUuidFromApproval(tenantId, approvalData.uuid);
      if (sourceUuid === null) {
        this.logger.warn(`No source_uuid found for approval ${approvalData.uuid}`);
        return;
      }

      const suggestion = await this.findSuggestionByUuid(tenantId, sourceUuid);
      if (suggestion === null) {
        this.logger.warn(`KVP suggestion not found for source_uuid ${sourceUuid}`);
        return;
      }

      await this.syncKvpStatus(tenantId, suggestion, approvalData, decidedByUserId);
      await this.createDecisionNotification(tenantId, suggestion, approvalData, requestedByUserId);

      this.logger.log(
        `KVP ${suggestion.uuid} synced to '${approvalData.status}' via approval decision`,
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to handle approval decision: ${getErrorMessage(error)}`);
    }
  }

  // ==========================================================================
  // STARTUP RECONCILIATION
  // ==========================================================================

  /**
   * Find KVPs stuck in 'in_review' with a decided approval and sync them.
   *
   * Runs in onModuleInit — no CLS context, no tenantId available.
   * Uses systemQuery (sys_user, BYPASSRLS) for the cross-tenant scan;
   * per-tenant writes inside syncKvpStatus use queryAsTenant with explicit
   * tenantId from each row (still enforced by RLS via app_user).
   */
  private async reconcilePendingApprovals(): Promise<void> {
    try {
      const stuckRows = await this.db.systemQuery<{
        kvp_uuid: string;
        kvp_id: number;
        kvp_title: string;
        approval_uuid: string;
        approval_status: string;
        decision_note: string | null;
        tenant_id: number;
        requested_by: number;
        decided_by: number | null;
      }>(
        `SELECT
           ks.uuid AS kvp_uuid, ks.id AS kvp_id, ks.title AS kvp_title,
           a.uuid AS approval_uuid, a.status AS approval_status,
           a.decision_note, a.tenant_id, a.requested_by, a.decided_by
         FROM kvp_suggestions ks
         INNER JOIN approvals a
           ON a.source_uuid = ks.uuid
           AND a.addon_code = 'kvp'
           AND a.is_active = $1
         WHERE ks.status = 'in_review'
           AND a.status IN ('approved', 'rejected')`,
        [IS_ACTIVE.ACTIVE],
      );

      if (stuckRows.length === 0) {
        return;
      }

      this.logger.warn(`Reconciling ${String(stuckRows.length)} stuck KVP approval(s)`);

      for (const row of stuckRows) {
        const payload: ApprovalDecisionPayload = {
          uuid: row.approval_uuid.trim(),
          title: row.kvp_title,
          addonCode: 'kvp',
          status: row.approval_status,
          requestedByName: '',
          decisionNote: row.decision_note,
        };

        await this.syncKvpStatus(
          row.tenant_id,
          {
            id: row.kvp_id,
            uuid: row.kvp_uuid,
            title: row.kvp_title,
            status: 'in_review',
            submitted_by: row.requested_by,
          },
          payload,
          row.decided_by ?? 0,
        );
      }
    } catch (error: unknown) {
      this.logger.error(`Reconciliation failed: ${getErrorMessage(error)}`);
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async findSuggestion(
    tenantId: number,
    idOrUuid: number | string,
  ): Promise<KvpSuggestionStub> {
    const idColumn = isUuid(idOrUuid) ? 'uuid' : 'id';
    const rows = await this.db.tenantQuery<KvpSuggestionStub>(
      `SELECT id, uuid, title, status, submitted_by
       FROM kvp_suggestions
       WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [idOrUuid, tenantId],
    );

    const suggestion = rows[0];
    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return suggestion;
  }

  private async findSuggestionByUuid(
    tenantId: number,
    uuid: string,
  ): Promise<KvpSuggestionStub | null> {
    const rows = await this.db.tenantQuery<KvpSuggestionStub>(
      `SELECT id, uuid, title, status, submitted_by
       FROM kvp_suggestions
       WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );

    return rows[0] ?? null;
  }

  private assertStatusAllowsApproval(status: string): void {
    if (status !== 'new' && status !== 'restored') {
      throw new BadRequestException(
        `Freigabe kann nur für Status 'offen' oder 'wiederhergestellt' angefordert werden (aktuell: '${status}')`,
      );
    }
  }

  private async assertNoExistingApproval(tenantId: number, suggestionUuid: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ uuid: string }>(
      `SELECT uuid FROM approvals
       WHERE addon_code = 'kvp'
         AND source_uuid = $1
         AND tenant_id = $2
         AND is_active = $3
       LIMIT 1`,
      [suggestionUuid.trim(), tenantId, IS_ACTIVE.ACTIVE],
    );

    if (rows.length > 0) {
      throw new ConflictException(
        'Für diesen KVP-Vorschlag existiert bereits eine Freigabe-Anfrage',
      );
    }
  }

  private async getSourceUuidFromApproval(
    tenantId: number,
    approvalUuid: string,
  ): Promise<string | null> {
    const rows = await this.db.tenantQuery<{ source_uuid: string }>(
      `SELECT source_uuid FROM approvals
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = $3`,
      [approvalUuid, tenantId, IS_ACTIVE.ACTIVE],
    );

    return rows[0]?.source_uuid.trim() ?? null;
  }

  /**
   * Sync KVP status — replicates buildSuggestionUpdateClause side effects.
   *
   * Uses queryAsTenant (explicit tenantId, no CLS dependency) so this method
   * works from both the EventBus handler (where CLS may or may not be
   * inherited via async_hooks) and the onModuleInit reconciliation loop
   * (where CLS is guaranteed absent). RLS is still enforced — queryAsTenant
   * sets the app.tenant_id GUC for the transaction.
   */
  private async syncKvpStatus(
    tenantId: number,
    suggestion: KvpSuggestionStub,
    approvalData: ApprovalDecisionPayload,
    decidedByUserId: number,
  ): Promise<void> {
    if (suggestion.status === approvalData.status) {
      return; // idempotent
    }

    if (approvalData.status === 'approved') {
      await this.db.queryAsTenant(
        `UPDATE kvp_suggestions
         SET status = 'approved', rejection_reason = NULL, implementation_date = NULL, updated_at = NOW()
         WHERE uuid = $1 AND tenant_id = $2`,
        [suggestion.uuid, tenantId],
        tenantId,
      );
    } else if (approvalData.status === 'rejected') {
      await this.db.queryAsTenant(
        `UPDATE kvp_suggestions
         SET status = 'rejected', rejection_reason = $1, implementation_date = NULL, updated_at = NOW()
         WHERE uuid = $2 AND tenant_id = $3`,
        [approvalData.decisionNote ?? '', suggestion.uuid, tenantId],
        tenantId,
      );
    }

    void this.activityLogger.logUpdate(
      tenantId,
      decidedByUserId,
      'kvp',
      suggestion.id,
      `KVP '${suggestion.title}' → ${approvalData.status} (via Freigabe-Entscheidung)`,
    );
  }

  private async updateSuggestionStatus(
    tenantId: number,
    uuid: string,
    status: string,
  ): Promise<void> {
    await this.db.tenantQuery(
      `UPDATE kvp_suggestions
       SET status = $1, rejection_reason = NULL, implementation_date = NULL, updated_at = NOW()
       WHERE uuid = $2 AND tenant_id = $3`,
      [status, uuid, tenantId],
    );
  }

  // ==========================================================================
  // PERSISTENT NOTIFICATIONS (ADR-004)
  // ==========================================================================

  private async createRequestNotifications(
    tenantId: number,
    suggestion: KvpSuggestionStub,
    requestedBy: number,
  ): Promise<void> {
    try {
      const approverIds = await this.approvalsConfigService.resolveApprovers('kvp', requestedBy);

      for (const approverId of approverIds) {
        await this.notificationsService.createAddonNotification(
          'kvp',
          suggestion.id,
          'Neue Freigabe-Anfrage',
          `Freigabe-Anfrage: ${suggestion.title}`,
          'user',
          approverId,
          tenantId,
          requestedBy,
        );
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to create request notifications: ${getErrorMessage(error)}`);
    }
  }

  private async createDecisionNotification(
    tenantId: number,
    suggestion: KvpSuggestionStub,
    approvalData: ApprovalDecisionPayload,
    requestedByUserId: number,
  ): Promise<void> {
    try {
      const isApproved = approvalData.status === 'approved';
      const title = isApproved ? 'Freigabe erteilt' : 'Freigabe abgelehnt';
      const message =
        isApproved ?
          `Freigabe erteilt: ${suggestion.title}`
        : `Freigabe abgelehnt: ${suggestion.title} — ${approvalData.decisionNote ?? ''}`;

      await this.notificationsService.createAddonNotification(
        'kvp',
        suggestion.id,
        title,
        message,
        'user',
        requestedByUserId,
        tenantId,
        requestedByUserId,
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to create decision notification: ${getErrorMessage(error)}`);
    }
  }
}
