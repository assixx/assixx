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
 *   - Bridge: approved execution → machine_maintenance_history (Step 2.11)
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
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
import type {
  TpmApprovalStatus,
  TpmCardExecution,
  TpmCardExecutionRow,
} from './tpm.types.js';

@Injectable()
export class TpmApprovalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cardStatusService: TpmCardStatusService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Approve an execution (yellow → green).
   *
   * Transaction flow:
   *   1. Lock execution row (FOR UPDATE)
   *   2. Validate execution is pending
   *   3. Validate user can approve (team lead or admin)
   *   4. Update execution: approval_status → approved
   *   5. Transition card: yellow → green (via cardStatusService)
   */
  async approveExecution(
    tenantId: number,
    executionUuid: string,
    approverId: number,
    dto: RespondExecutionDto,
  ): Promise<TpmCardExecution> {
    const { result, machineId } = await this.db.tenantTransaction(
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

        const cardMachineId = await this.resolveCardMachineId(
          client,
          tenantId,
          execution.card_id,
        );

        await client.query(
          `UPDATE tpm_card_executions
           SET approval_status = 'approved',
               approved_by = $1,
               approved_at = NOW(),
               approval_note = $2,
               updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [approverId, dto.approvalNote ?? null, execution.id, tenantId],
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
        return { result: fetched, machineId: cardMachineId };
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      approverId,
      'tpm_execution',
      machineId,
      `TPM-Durchführung freigegeben: ${executionUuid}`,
      { approvalStatus: 'pending' },
      { approvalStatus: 'approved' },
    );

    return result;
  }

  /**
   * Reject an execution (yellow → red).
   *
   * Transaction flow:
   *   1. Lock execution row (FOR UPDATE)
   *   2. Validate execution is pending
   *   3. Validate user can approve (team lead or admin)
   *   4. Update execution: approval_status → rejected
   *   5. Transition card: yellow → red (via cardStatusService)
   */
  async rejectExecution(
    tenantId: number,
    executionUuid: string,
    approverId: number,
    dto: RespondExecutionDto,
  ): Promise<TpmCardExecution> {
    const { result, machineId } = await this.db.tenantTransaction(
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

        const cardMachineId = await this.resolveCardMachineId(
          client,
          tenantId,
          execution.card_id,
        );

        await client.query(
          `UPDATE tpm_card_executions
           SET approval_status = 'rejected',
               approved_by = $1,
               approved_at = NOW(),
               approval_note = $2,
               updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [approverId, dto.approvalNote ?? null, execution.id, tenantId],
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
        return { result: fetched, machineId: cardMachineId };
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      approverId,
      'tpm_execution',
      machineId,
      `TPM-Durchführung abgelehnt: ${executionUuid} — ${dto.approvalNote ?? ''}`,
      { approvalStatus: 'pending' },
      { approvalStatus: 'rejected' },
    );

    return result;
  }

  /**
   * Check if a user can approve executions for a given card.
   *
   * Authorization chain:
   *   1. User is team_lead_id of a team assigned to the card's machine
   *   2. OR: User has has_full_access = 1 (admin)
   */
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
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Lock an execution row and validate it is still pending.
   * Prevents race conditions on parallel approve/reject.
   */
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

  /**
   * Validate that a user is authorized to approve/reject.
   * Team lead of a machine-owning team OR admin (has_full_access).
   */
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

  /** Resolve machine_id from a card (for activity logging) */
  private async resolveCardMachineId(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<number> {
    const result = await client.query<{ machine_id: number }>(
      `SELECT machine_id FROM tpm_cards
       WHERE id = $1 AND tenant_id = $2`,
      [cardId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`TPM-Karte ${cardId} nicht gefunden`);
    }
    return row.machine_id;
  }
}
