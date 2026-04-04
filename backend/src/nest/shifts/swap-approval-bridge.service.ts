/**
 * Swap Approval Bridge Service
 *
 * Connects shift swap requests to the generic approvals system.
 * - Creates approval entries when partner accepts a swap
 * - Listens for `approval.decided` events to execute or reject swaps
 *
 * @see docs/FEAT_SWAP_REQUEST_MASTERPLAN.md (Step 2.4)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { eventBus } from '../../utils/event-bus.js';
import { ApprovalsConfigService } from '../approvals/approvals-config.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import type { Approval } from '../approvals/approvals.types.js';
import { DatabaseService } from '../database/database.service.js';
import { ShiftSwapService } from './shift-swap.service.js';

const ADDON_CODE = 'shift_planning';
const SOURCE_ENTITY_TYPE = 'shift_swap_request';

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
export class SwapApprovalBridgeService implements OnModuleInit {
  private readonly logger = new Logger(SwapApprovalBridgeService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly approvalsService: ApprovalsService,
    private readonly approvalsConfigService: ApprovalsConfigService,
    private readonly shiftSwapService: ShiftSwapService,
  ) {}

  onModuleInit(): void {
    this.subscribeToApprovalDecisions();
    this.logger.log('SwapApprovalBridge initialized');
  }

  // ----------------------------------------------------------
  // CREATE APPROVAL (called by controller after partner accepts)
  // ----------------------------------------------------------

  async createApprovalForSwap(
    swapUuid: string,
    tenantId: number,
    requesterId: number,
    title: string,
    description?: string,
  ): Promise<Approval> {
    await this.ensureApprovalConfig(tenantId);

    const approval = await this.approvalsService.create(
      {
        addonCode: ADDON_CODE,
        sourceEntityType: SOURCE_ENTITY_TYPE,
        sourceUuid: swapUuid,
        title,
        description,
        priority: 'medium',
      },
      tenantId,
      requesterId,
    );

    // Link approval UUID back to the swap request
    await this.db.tenantQuery(
      `UPDATE shift_swap_requests SET approval_uuid = $1 WHERE uuid = $2::uuid AND tenant_id = $3`,
      [approval.uuid, swapUuid, tenantId],
    );

    this.logger.log(`Approval ${approval.uuid} created for swap ${swapUuid}`);
    return approval;
  }

  // ----------------------------------------------------------
  // EVENT HANDLER
  // ----------------------------------------------------------

  private subscribeToApprovalDecisions(): void {
    eventBus.on(
      'approval.decided',
      (data: {
        tenantId: number;
        approval: ApprovalDecisionPayload;
        requestedByUserId: number;
        decidedByUserId?: number;
      }) => {
        if (data.approval.addonCode !== ADDON_CODE) return;
        void this.handleApprovalDecision(data.tenantId, data.approval);
      },
    );
  }

  private async handleApprovalDecision(
    tenantId: number,
    approvalData: ApprovalDecisionPayload,
  ): Promise<void> {
    try {
      const source = await this.getApprovalSource(tenantId, approvalData.uuid);
      if (source === null) {
        this.logger.warn(`No source for approval ${approvalData.uuid}`);
        return;
      }

      // Only handle shift_swap_request entities (shift_planning also has shift-plan etc.)
      if (source.entityType !== SOURCE_ENTITY_TYPE) return;

      if (approvalData.status === 'approved') {
        await this.shiftSwapService.executeSwap(source.uuid, tenantId);
        this.logger.log(`Swap ${source.uuid} executed via approval ${approvalData.uuid}`);
      } else if (approvalData.status === 'rejected') {
        await this.db.tenantQuery(
          `UPDATE shift_swap_requests SET status = 'rejected' WHERE uuid = $1::uuid AND tenant_id = $2`,
          [source.uuid, tenantId],
        );
        this.logger.log(`Swap ${source.uuid} rejected via approval ${approvalData.uuid}`);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to handle approval decision: ${String(error)}`);
    }
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /** Ensure approval_configs has a team_lead entry for shift_planning (C2 fix) */
  private async ensureApprovalConfig(tenantId: number): Promise<void> {
    const existing = await this.db.tenantQuery<{ id: number }>(
      `SELECT id FROM approval_configs
       WHERE tenant_id = $1 AND addon_code = $2 AND approver_type = 'team_lead' AND is_active = $3`,
      [tenantId, ADDON_CODE, IS_ACTIVE.ACTIVE],
    );

    if (existing.length > 0) return;

    await this.approvalsConfigService.createConfig(
      { addonCode: ADDON_CODE, approverType: 'team_lead' as const },
      tenantId,
      0,
    );
    this.logger.log(`Created approval config (team_lead) for ${ADDON_CODE} in tenant ${tenantId}`);
  }

  /** Single query to get both source_uuid and source_entity_type */
  private async getApprovalSource(
    tenantId: number,
    approvalUuid: string,
  ): Promise<{ uuid: string; entityType: string } | null> {
    const rows = await this.db.tenantQuery<{ source_uuid: string; source_entity_type: string }>(
      `SELECT source_uuid, source_entity_type FROM approvals WHERE uuid = $1 AND tenant_id = $2 AND is_active = $3`,
      [approvalUuid, tenantId, IS_ACTIVE.ACTIVE],
    );
    if (rows.length === 0 || rows[0] === undefined) return null;
    return { uuid: rows[0].source_uuid.trim(), entityType: rows[0].source_entity_type };
  }
}
