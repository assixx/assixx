/**
 * TPM Plan Approval Bridge Service
 *
 * Bridges TPM Plan management with the centralized Approvals system (ADR-037).
 * Creates approval requests on plan create/edit. Listens for approval decisions
 * to bump approval_version. Approval status is informational (D1) — plans remain
 * fully operational regardless of status.
 *
 * Base pattern: KvpApprovalService — extended with version bumping logic.
 * Key differences from KVP:
 *   - Does NOT sync source entity status (no blocking)
 *   - Does NOT supersede pending approvals on edit (D3)
 *   - Bumps approval_version on approve event (D2)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import type { TpmMaintenancePlanRow } from './tpm.types.js';

const ADDON_CODE = 'tpm';
const SOURCE_ENTITY_TYPE = 'tpm_plan';

/** Event payload shape from eventBus.emitApprovalDecided() */
interface ApprovalDecisionPayload {
  uuid: string;
  title: string;
  addonCode: string;
  status: string;
  requestedByName: string;
  decidedByName?: string;
  decisionNote?: string | null;
}

@Injectable()
export class TpmPlanApprovalService implements OnModuleInit {
  private readonly logger = new Logger(TpmPlanApprovalService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly approvalsService: ApprovalsService,
    private readonly activityLogger: ActivityLoggerService,
  ) {
    this.subscribeToApprovalDecisions();
  }

  async onModuleInit(): Promise<void> {
    await this.reconcilePendingApprovals();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /** Check if any TPM approval master is configured for this tenant (D6) */
  async hasApprovalConfig(tenantId: number): Promise<boolean> {
    const rows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM approval_configs
       WHERE addon_code = $1
         AND tenant_id = $2
         AND is_active = $3`,
      [ADDON_CODE, tenantId, IS_ACTIVE.ACTIVE],
    );
    return Number(rows[0]?.count ?? '0') > 0;
  }

  /** Check if a pending approval exists for this plan (D3) */
  async hasPendingApproval(tenantId: number, planUuid: string): Promise<boolean> {
    const rows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM approvals
       WHERE addon_code = $1
         AND source_entity_type = $2
         AND source_uuid = $3
         AND status = 'pending'
         AND tenant_id = $4
         AND is_active = $5`,
      [ADDON_CODE, SOURCE_ENTITY_TYPE, planUuid, tenantId, IS_ACTIVE.ACTIVE],
    );
    return Number(rows[0]?.count ?? '0') > 0;
  }

  /** Create approval request via central Approvals system (D4, D6) */
  async requestApproval(
    tenantId: number,
    userId: number,
    planUuid: string,
    planName: string,
    assetName: string,
  ): Promise<void> {
    const hasConfig = await this.hasApprovalConfig(tenantId);
    if (!hasConfig) {
      this.logger.debug('No TPM approval master configured — skipping approval request');
      return;
    }

    try {
      // Resolve asset name if missing (RETURNING * doesn't include JOINs)
      let resolvedAssetName = assetName;
      if (resolvedAssetName === '') {
        const rows = await this.db.tenantQuery<{ asset_name: string }>(
          `SELECT a.name AS asset_name
           FROM tpm_maintenance_plans p
           JOIN assets a ON a.id = p.asset_id AND a.tenant_id = p.tenant_id
           WHERE p.uuid = $1 AND p.tenant_id = $2`,
          [planUuid, tenantId],
        );
        resolvedAssetName = rows[0]?.asset_name ?? '';
      }

      await this.approvalsService.create(
        {
          addonCode: ADDON_CODE,
          sourceEntityType: SOURCE_ENTITY_TYPE,
          sourceUuid: planUuid,
          title: `TPM Plan: ${planName} (${resolvedAssetName})`,
          priority: 'medium',
        },
        tenantId,
        userId,
      );

      this.logger.log(`Approval requested for TPM plan ${planUuid}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create approval for plan ${planUuid}: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Batch query: latest approval status per plan UUID (for listPlans enrichment) */
  async getApprovalStatusForPlans(
    tenantId: number,
    planUuids: readonly string[],
  ): Promise<Map<string, string>> {
    if (planUuids.length === 0) {
      return new Map();
    }

    const placeholders = planUuids.map((_: string, i: number) => `$${i + 2}`).join(', ');
    const rows = await this.db.tenantQuery<{ source_uuid: string; status: string }>(
      `SELECT DISTINCT ON (source_uuid) source_uuid, status
       FROM approvals
       WHERE addon_code = '${ADDON_CODE}'
         AND source_entity_type = '${SOURCE_ENTITY_TYPE}'
         AND tenant_id = $1
         AND source_uuid IN (${placeholders})
         AND is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY source_uuid, created_at DESC`,
      [tenantId, ...planUuids],
    );

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.source_uuid.trim(), row.status);
    }
    return map;
  }

  // ==========================================================================
  // Event Handling
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
        if (data.approval.addonCode === ADDON_CODE) {
          void this.handleApprovalDecision(data.tenantId, data.approval, data.decidedByUserId ?? 0);
        }
      },
    );
  }

  /** Handle approval decision — bump version on approve, no-op on reject (D1) */
  private async handleApprovalDecision(
    tenantId: number,
    approvalData: ApprovalDecisionPayload,
    decidedByUserId: number,
  ): Promise<void> {
    if (approvalData.status !== 'approved') {
      return; // Rejected = no-op, plan stays operational (D1)
    }

    try {
      // D7: Event payload doesn't include sourceUuid — resolve via DB query
      const sourceUuid = await this.getSourceUuidFromApproval(tenantId, approvalData.uuid);
      if (sourceUuid === null) {
        this.logger.warn(`No source_uuid found for approval ${approvalData.uuid}`);
        return;
      }

      await this.bumpApprovalVersion(tenantId, sourceUuid, decidedByUserId);
    } catch (error: unknown) {
      this.logger.error(`Failed to handle approval decision: ${getErrorMessage(error)}`);
    }
  }

  /** Resolve sourceUuid from approval UUID (D7) */
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

  /** Bump approval_version and reset revision_minor (D2) */
  private async bumpApprovalVersion(
    tenantId: number,
    planUuid: string,
    decidedBy: number,
  ): Promise<void> {
    // Use explicit tenant_id (no CLS context in event handler)
    const planRows = await this.db.tenantQuery<TpmMaintenancePlanRow>(
      `SELECT * FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = $3
       FOR UPDATE`,
      [planUuid, tenantId, IS_ACTIVE.ACTIVE],
    );
    const plan = planRows[0];
    if (plan === undefined) {
      this.logger.warn(`Plan ${planUuid} not found for version bump`);
      return;
    }

    const newApprovalVersion = plan.approval_version + 1;

    await this.db.tenantQuery(
      `UPDATE tpm_maintenance_plans
       SET approval_version = $1, revision_minor = 0, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [newApprovalVersion, plan.id, tenantId],
    );

    // Insert revision snapshot for the approval event
    await this.db.tenantQuery(
      `INSERT INTO tpm_plan_revisions
         (uuid, tenant_id, plan_id, revision_number, approval_version, revision_minor,
          name, asset_id, base_weekday, base_repeat_every, base_time,
          buffer_hours, notes,
          changed_by, change_reason, changed_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        uuidv7(),
        tenantId,
        plan.id,
        plan.revision_number,
        newApprovalVersion,
        0,
        plan.name,
        plan.asset_id,
        plan.base_weekday,
        plan.base_repeat_every,
        plan.base_time,
        plan.buffer_hours,
        plan.notes,
        decidedBy,
        `Approved: v${newApprovalVersion}.0`,
        ['approval_version', 'revision_minor'],
      ],
    );

    this.logger.log(`Plan ${planUuid} bumped to v${newApprovalVersion}.0`);

    void this.activityLogger.logUpdate(
      tenantId,
      decidedBy,
      'tpm_plan',
      plan.id,
      `TPM Plan genehmigt: v${newApprovalVersion}.0 — ${plan.name}`,
      { planUuid, approvalVersion: newApprovalVersion },
    );
  }

  // ==========================================================================
  // Startup Reconciliation
  // ==========================================================================

  /** Find plans with missed approval decisions and sync version (onModuleInit) */
  private async reconcilePendingApprovals(): Promise<void> {
    try {
      const rows = await this.db.tenantQuery<{
        tenant_id: number;
        plan_uuid: string;
        plan_id: number;
        plan_approval_version: number;
        approved_count: number;
      }>(
        `SELECT p.tenant_id, p.uuid AS plan_uuid, p.id AS plan_id,
                p.approval_version AS plan_approval_version,
                COUNT(a.id)::integer AS approved_count
         FROM tpm_maintenance_plans p
         JOIN approvals a ON a.source_uuid = p.uuid
           AND a.addon_code = $1
           AND a.source_entity_type = $2
           AND a.status = 'approved'
           AND a.is_active = $3
           AND a.tenant_id = p.tenant_id
         WHERE p.is_active = $4
         GROUP BY p.tenant_id, p.uuid, p.id, p.approval_version
         HAVING COUNT(a.id) > p.approval_version`,
        [ADDON_CODE, SOURCE_ENTITY_TYPE, IS_ACTIVE.ACTIVE, IS_ACTIVE.ACTIVE],
      );

      if (rows.length === 0) {
        return;
      }

      this.logger.warn(`Reconciling ${rows.length} plans with missed approval decisions`);

      for (const row of rows) {
        await this.db.tenantQuery(
          `UPDATE tpm_maintenance_plans
           SET approval_version = $1, revision_minor = 0, updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3`,
          [row.approved_count, row.plan_id, row.tenant_id],
        );
        this.logger.log(`Reconciled plan ${row.plan_uuid}: v${row.approved_count}.0`);
      }
    } catch (error: unknown) {
      this.logger.error(`Startup reconciliation failed: ${getErrorMessage(error)}`);
    }
  }
}
