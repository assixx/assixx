/**
 * TPM Approval Service
 *
 * Handles approval/rejection of card executions that require sign-off.
 * Pattern: 1:1 from vacation.service.ts:respondToRequest()
 *
 * Authorization chain:
 *   Card → machine_id → machine_teams → teams → team_lead_id
 *   OR: user.has_full_access = 1 (admin override)
 *
 * Post-transaction side effects:
 *   - Activity logging (fire-and-forget)
 *   - SSE notification to executor (fire-and-forget)
 *   - Bridge: approved execution → machine_maintenance_history (Step 2.11)
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { RespondExecutionDto } from './dto/respond-execution.dto.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import {
  type TpmExecutionJoinRow,
  mapExecutionRowToApi,
} from './tpm-executions.helpers.js';
import type { TpmNotificationCard } from './tpm-notification.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import type {
  TpmApprovalStatus,
  TpmCardExecution,
  TpmCardExecutionRow,
} from './tpm.types.js';

/** Card info resolved within the transaction for side effects */
interface CardInfo {
  machineId: number;
  notification: TpmNotificationCard;
}

@Injectable()
export class TpmApprovalService {
  private readonly logger = new Logger(TpmApprovalService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cardStatusService: TpmCardStatusService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly notificationService: TpmNotificationService,
  ) {}

  /** Approve an execution (yellow → green) */
  async approveExecution(
    tenantId: number,
    executionUuid: string,
    approverId: number,
    dto: RespondExecutionDto,
  ): Promise<TpmCardExecution> {
    const { result, cardInfo } = await this.db.tenantTransaction(
      async (client: PoolClient) => {
        const execution = await this.lockPendingExecution(
          client,
          tenantId,
          executionUuid,
        );
        await this.validateApprover(
          client,
          tenantId,
          approverId,
          execution.card_id,
        );
        const info = await this.resolveCardInfo(
          client,
          tenantId,
          execution.card_id,
        );

        await this.updateApprovalStatus(
          client,
          tenantId,
          execution.id,
          approverId,
          'approved',
          dto,
        );
        await this.cardStatusService.approveCard(
          client,
          tenantId,
          execution.card_id,
          execution.executed_by,
        );

        const fetched = await this.fetchExecution(
          client,
          tenantId,
          execution.id,
        );
        return { result: fetched, cardInfo: info };
      },
    );

    void this.fireApprovalEffects(
      tenantId,
      approverId,
      cardInfo,
      executionUuid,
      result,
    );

    return result;
  }

  /** Reject an execution (yellow → red) */
  async rejectExecution(
    tenantId: number,
    executionUuid: string,
    approverId: number,
    dto: RespondExecutionDto,
  ): Promise<TpmCardExecution> {
    const { result, cardInfo } = await this.db.tenantTransaction(
      async (client: PoolClient) => {
        const execution = await this.lockPendingExecution(
          client,
          tenantId,
          executionUuid,
        );
        await this.validateApprover(
          client,
          tenantId,
          approverId,
          execution.card_id,
        );
        const info = await this.resolveCardInfo(
          client,
          tenantId,
          execution.card_id,
        );

        await this.updateApprovalStatus(
          client,
          tenantId,
          execution.id,
          approverId,
          'rejected',
          dto,
        );
        await this.cardStatusService.rejectCard(
          client,
          tenantId,
          execution.card_id,
        );

        const fetched = await this.fetchExecution(
          client,
          tenantId,
          execution.id,
        );
        return { result: fetched, cardInfo: info };
      },
    );

    this.fireRejectionEffects(
      tenantId,
      approverId,
      cardInfo,
      executionUuid,
      result,
      dto,
    );

    return result;
  }

  /** Check if a user can approve executions for a given card */
  async canUserApprove(
    tenantId: number,
    userId: number,
    cardId: number,
  ): Promise<boolean> {
    const result = await this.db.queryOne<{ can_approve: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM teams t
        JOIN machine_teams mt ON t.id = mt.team_id AND mt.tenant_id = t.tenant_id
        JOIN tpm_cards c ON c.machine_id = mt.machine_id AND c.tenant_id = mt.tenant_id
        WHERE c.id = $1
          AND c.tenant_id = $2
          AND t.team_lead_id = $3
          AND t.is_active = 1
      ) OR EXISTS (
        SELECT 1 FROM users
        WHERE id = $3 AND tenant_id = $2
          AND has_full_access = 1 AND is_active = 1
      ) AS can_approve`,
      [cardId, tenantId, userId],
    );

    return result?.can_approve === true;
  }

  // ============================================================================
  // SIDE EFFECTS (fire-and-forget)
  // ============================================================================

  /** Log + notify + bridge after approval */
  private async fireApprovalEffects(
    tenantId: number,
    approverId: number,
    cardInfo: CardInfo,
    executionUuid: string,
    result: TpmCardExecution,
  ): Promise<void> {
    void this.activityLogger.logUpdate(
      tenantId,
      approverId,
      'tpm_execution',
      cardInfo.machineId,
      `TPM-Durchführung freigegeben: ${executionUuid}`,
      { approvalStatus: 'pending' },
      { approvalStatus: 'approved' },
    );

    this.notificationService.notifyApprovalResult(
      tenantId,
      cardInfo.notification,
      executionUuid,
      result.executedBy,
      true,
    );

    await this.bridgeToMaintenanceHistory(
      tenantId,
      cardInfo.machineId,
      result.executedBy,
      executionUuid,
    );
  }

  /** Log + notify after rejection */
  private fireRejectionEffects(
    tenantId: number,
    approverId: number,
    cardInfo: CardInfo,
    executionUuid: string,
    result: TpmCardExecution,
    dto: RespondExecutionDto,
  ): void {
    void this.activityLogger.logUpdate(
      tenantId,
      approverId,
      'tpm_execution',
      cardInfo.machineId,
      `TPM-Durchführung abgelehnt: ${executionUuid} — ${dto.approvalNote ?? ''}`,
      { approvalStatus: 'pending' },
      { approvalStatus: 'rejected' },
    );

    this.notificationService.notifyApprovalResult(
      tenantId,
      cardInfo.notification,
      executionUuid,
      result.executedBy,
      false,
    );
  }

  /**
   * Bridge: approved execution → machine_maintenance_history entry.
   * Direct DB query (D11 pattern — TpmModule stays self-contained).
   */
  private async bridgeToMaintenanceHistory(
    tenantId: number,
    machineId: number,
    performedBy: number,
    executionUuid: string,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO machine_maintenance_history
           (tenant_id, machine_id, maintenance_type, performed_date,
            performed_by, description, status_after, created_by)
         VALUES ($1, $2, 'preventive', CURRENT_DATE, $3, $4, 'operational', $3)`,
        [tenantId, machineId, performedBy, `TPM-Durchführung ${executionUuid}`],
      );
    } catch (error: unknown) {
      this.logger.error(`Machine history bridge failed: ${String(error)}`);
    }
  }

  // ============================================================================
  // TRANSACTION HELPERS
  // ============================================================================

  /** Lock an execution row and validate it is still pending */
  private async lockPendingExecution(
    client: PoolClient,
    tenantId: number,
    executionUuid: string,
  ): Promise<TpmCardExecutionRow> {
    const result = await client.query<TpmCardExecutionRow>(
      `SELECT * FROM tpm_card_executions
       WHERE uuid = $1 AND tenant_id = $2
       FOR UPDATE`,
      [executionUuid, tenantId],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(
        `Durchführung ${executionUuid} nicht gefunden`,
      );
    }

    if (row.approval_status !== 'pending') {
      throw new ConflictException(
        `Durchführung wurde bereits bearbeitet (Status: ${row.approval_status as TpmApprovalStatus})`,
      );
    }

    return row;
  }

  /** Validate that a user is authorized to approve/reject */
  private async validateApprover(
    client: PoolClient,
    tenantId: number,
    approverId: number,
    cardId: number,
  ): Promise<void> {
    const result = await client.query<{ can_approve: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM teams t
        JOIN machine_teams mt ON t.id = mt.team_id AND mt.tenant_id = t.tenant_id
        JOIN tpm_cards c ON c.machine_id = mt.machine_id AND c.tenant_id = mt.tenant_id
        WHERE c.id = $1
          AND c.tenant_id = $2
          AND t.team_lead_id = $3
          AND t.is_active = 1
      ) OR EXISTS (
        SELECT 1 FROM users
        WHERE id = $3 AND tenant_id = $2
          AND has_full_access = 1 AND is_active = 1
      ) AS can_approve`,
      [cardId, tenantId, approverId],
    );

    if (result.rows[0]?.can_approve !== true) {
      throw new ForbiddenException(
        'Keine Berechtigung zur Freigabe dieser Durchführung',
      );
    }
  }

  /** Update the execution's approval status */
  private async updateApprovalStatus(
    client: PoolClient,
    tenantId: number,
    executionId: number,
    approverId: number,
    status: 'approved' | 'rejected',
    dto: RespondExecutionDto,
  ): Promise<void> {
    await client.query(
      `UPDATE tpm_card_executions
       SET approval_status = $1,
           approved_by = $2,
           approved_at = NOW(),
           approval_note = $3,
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [status, approverId, dto.approvalNote ?? null, executionId, tenantId],
    );
  }

  /** Fetch a full execution with JOINs (within transaction) */
  private async fetchExecution(
    client: PoolClient,
    tenantId: number,
    executionId: number,
  ): Promise<TpmCardExecution> {
    const result = await client.query<TpmExecutionJoinRow>(
      `SELECT e.*,
         c.uuid AS card_uuid,
         u_exec.username AS executed_by_name,
         u_appr.username AS approved_by_name
       FROM tpm_card_executions e
       LEFT JOIN tpm_cards c ON e.card_id = c.id
       LEFT JOIN users u_exec ON e.executed_by = u_exec.id
       LEFT JOIN users u_appr ON e.approved_by = u_appr.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [executionId, tenantId],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Durchführung ${executionId} nicht gefunden`);
    }

    return mapExecutionRowToApi(row);
  }

  /** Resolve card info for notification + side effects */
  private async resolveCardInfo(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<CardInfo> {
    const result = await client.query<{
      uuid: string;
      card_code: string;
      title: string;
      machine_id: number;
      interval_type: string;
      status: string;
    }>(
      `SELECT uuid, card_code, title, machine_id, interval_type, status
       FROM tpm_cards WHERE id = $1 AND tenant_id = $2`,
      [cardId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`TPM-Karte ${cardId} nicht gefunden`);
    }
    return {
      machineId: row.machine_id,
      notification: {
        uuid: row.uuid,
        cardCode: row.card_code,
        title: row.title,
        machineId: row.machine_id,
        intervalType: row.interval_type,
        status: row.status,
      },
    };
  }
}
