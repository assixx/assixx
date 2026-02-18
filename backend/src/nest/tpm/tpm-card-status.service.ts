/**
 * TPM Card Status Service
 *
 * Manages card status transitions in the TPM state machine.
 * All methods accept a PoolClient for transaction composability —
 * the caller manages the transaction boundary.
 *
 * State machine:
 *   green   → red     (setCardDue)
 *   red     → green   (markCardCompleted, Flow A — no approval)
 *   red     → yellow  (markCardCompleted, Flow B — approval required)
 *   red     → overdue (markCardOverdue)
 *   yellow  → green   (approveCard)
 *   yellow  → red     (rejectCard)
 *   overdue → green   (markCardCompleted, Flow A)
 *   overdue → yellow  (markCardCompleted, Flow B)
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import type { TpmCardRow, TpmCardStatus } from './tpm.types.js';

/** Valid status transitions */
const VALID_TRANSITIONS: Record<TpmCardStatus, readonly TpmCardStatus[]> = {
  green: ['red'],
  red: ['green', 'yellow', 'overdue'],
  yellow: ['green', 'red'],
  overdue: ['green', 'yellow'],
} as const;

/** Result of markCardCompleted — tells caller which approval status to use */
export interface CompletionResult {
  targetStatus: 'green' | 'yellow';
  requiresApproval: boolean;
}

@Injectable()
export class TpmCardStatusService {
  private readonly logger = new Logger(TpmCardStatusService.name);

  /**
   * Set a card as due (green → red).
   * Called by cascade service when an interval triggers.
   */
  async setCardDue(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    dueDate: Date,
  ): Promise<void> {
    const card = await this.lockCardById(client, tenantId, cardId);
    this.assertTransition(card.status, 'red');

    const dueDateStr = dueDate.toISOString().slice(0, 10);
    await client.query(
      `UPDATE tpm_cards
       SET status = 'red', current_due_date = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [dueDateStr, cardId, tenantId],
    );

    this.logger.debug(`Card ${cardId} → red (fällig: ${dueDateStr})`);
  }

  /**
   * Mark a card as completed by an employee.
   *
   * Flow A (no approval): red/overdue → green
   * Flow B (approval required): red/overdue → yellow
   *
   * Returns the result so the caller (executions service) knows
   * which approval_status to set on the execution record.
   */
  async markCardCompleted(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    userId: number,
  ): Promise<CompletionResult> {
    const card = await this.lockCardById(client, tenantId, cardId);

    if (card.status !== 'red' && card.status !== 'overdue') {
      throw new BadRequestException(
        `Karte kann nur im Status "red" oder "overdue" abgeschlossen werden (aktuell: ${card.status})`,
      );
    }

    if (card.requires_approval) {
      // Flow B: needs approval → yellow
      await client.query(
        `UPDATE tpm_cards
         SET status = 'yellow', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [cardId, tenantId],
      );
      this.logger.debug(`Card ${cardId} → yellow (Freigabe ausstehend)`);
      return { targetStatus: 'yellow', requiresApproval: true };
    }

    // Flow A: no approval needed → green
    await client.query(
      `UPDATE tpm_cards
       SET status = 'green', last_completed_at = NOW(),
           last_completed_by = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [userId, cardId, tenantId],
    );
    this.logger.debug(`Card ${cardId} → green (abgeschlossen von ${userId})`);
    return { targetStatus: 'green', requiresApproval: false };
  }

  /**
   * Mark a card as overdue (red → overdue).
   * Called by escalation cron after the threshold is exceeded.
   */
  async markCardOverdue(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<void> {
    const card = await this.lockCardById(client, tenantId, cardId);
    this.assertTransition(card.status, 'overdue');

    await client.query(
      `UPDATE tpm_cards
       SET status = 'overdue', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [cardId, tenantId],
    );

    this.logger.debug(`Card ${cardId} → overdue`);
  }

  /**
   * Approve a card's execution (yellow → green).
   * Sets last_completed_at/by from the original executor.
   */
  async approveCard(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    executedBy: number,
  ): Promise<void> {
    const card = await this.lockCardById(client, tenantId, cardId);
    this.assertTransition(card.status, 'green');

    await client.query(
      `UPDATE tpm_cards
       SET status = 'green', last_completed_at = NOW(),
           last_completed_by = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [executedBy, cardId, tenantId],
    );

    this.logger.debug(`Card ${cardId} → green (Freigabe erteilt)`);
  }

  /**
   * Reject a card's execution (yellow → red).
   * Card goes back to "due" state.
   */
  async rejectCard(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<void> {
    const card = await this.lockCardById(client, tenantId, cardId);
    this.assertTransition(card.status, 'red');

    await client.query(
      `UPDATE tpm_cards
       SET status = 'red', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [cardId, tenantId],
    );

    this.logger.debug(`Card ${cardId} → red (Freigabe abgelehnt)`);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Lock a card row by internal ID (SELECT ... FOR UPDATE) */
  private async lockCardById(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<TpmCardRow> {
    const result = await client.query<TpmCardRow>(
      `SELECT * FROM tpm_cards
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [cardId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`TPM-Karte ${cardId} nicht gefunden`);
    }
    return row;
  }

  /** Assert that a status transition is valid */
  private assertTransition(
    currentStatus: TpmCardStatus,
    targetStatus: TpmCardStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Ungültiger Statusübergang: ${currentStatus} → ${targetStatus}`,
      );
    }
  }
}
