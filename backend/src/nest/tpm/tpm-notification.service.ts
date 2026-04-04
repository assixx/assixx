/**
 * TPM Notification Service
 *
 * Dual-pattern: EventBus (SSE) + DB (persistent) — ADR-004.
 * Emits TPM lifecycle events for real-time SSE delivery
 * AND creates persistent notifications for badge counts + read tracking.
 *
 * Called by TpmExecutionsService, TpmApprovalService, TpmEscalationService
 * after successful status transitions.
 */
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { type TpmEvent, eventBus } from '../../utils/event-bus.js';
import { DatabaseService } from '../database/database.service.js';

/** Card info needed for notification display */
export interface TpmNotificationCard {
  uuid: string;
  cardCode: string;
  title: string;
  assetId: number;
  assetName?: string;
  intervalType: string;
  status: string;
}

@Injectable()
export class TpmNotificationService {
  private readonly logger = new Logger(TpmNotificationService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Notify that a maintenance card is now due (red).
   * Recipients: users assigned to the asset's teams.
   */
  notifyMaintenanceDue(
    tenantId: number,
    card: TpmNotificationCard,
    assignedUserIds: number[],
  ): void {
    this.logger.log(
      `TPM card due: ${card.cardCode} (${card.uuid}) on asset ${String(card.assetId)}`,
    );
    eventBus.emitTpmMaintenanceDue(tenantId, this.toEventPayload(card));

    for (const userId of assignedUserIds) {
      void this.createPersistentNotification(
        tenantId,
        userId,
        `Wartung fällig: ${card.cardCode}`,
        `${card.title} an ${card.assetName ?? `Anlage #${String(card.assetId)}`} ist fällig (${card.intervalType})`,
        userId,
        card.uuid,
      );
    }
  }

  /**
   * Notify that a maintenance card is overdue (escalation).
   * Recipient: team lead responsible for the asset.
   */
  notifyMaintenanceOverdue(tenantId: number, card: TpmNotificationCard, teamLeadId: number): void {
    this.logger.log(
      `TPM card overdue: ${card.cardCode} (${card.uuid}) — escalating to lead ${String(teamLeadId)}`,
    );
    eventBus.emitTpmMaintenanceOverdue(tenantId, this.toEventPayload(card));

    void this.createPersistentNotification(
      tenantId,
      teamLeadId,
      `Eskalation: ${card.cardCode} überfällig`,
      `${card.title} an ${card.assetName ?? `Anlage #${String(card.assetId)}`} ist überfällig`,
      teamLeadId,
      card.uuid,
    );
  }

  /**
   * Notify that a maintenance card was completed.
   * Recipients: team leads of the asset's teams.
   */
  notifyMaintenanceCompleted(
    tenantId: number,
    card: TpmNotificationCard,
    executedBy: number,
  ): void {
    this.logger.log(
      `TPM card completed: ${card.cardCode} (${card.uuid}) by user ${String(executedBy)}`,
    );
    eventBus.emitTpmMaintenanceCompleted(tenantId, this.toEventPayload(card), executedBy);
  }

  /**
   * Notify that a card execution requires approval (yellow).
   * Recipients: users who can approve (team leads + admins).
   */
  notifyApprovalRequired(
    tenantId: number,
    card: TpmNotificationCard,
    executionUuid: string,
    approverIds: number[],
  ): void {
    this.logger.log(
      `TPM approval required: ${card.cardCode} (${card.uuid}), execution ${executionUuid}`,
    );
    eventBus.emitTpmApprovalRequired(tenantId, this.toEventPayload(card), executionUuid);

    for (const approverId of approverIds) {
      void this.createPersistentNotification(
        tenantId,
        approverId,
        `Freigabe erforderlich: ${card.cardCode}`,
        `${card.title} an ${card.assetName ?? `Anlage #${String(card.assetId)}`} wartet auf Freigabe`,
        approverId,
        card.uuid,
      );
    }
  }

  /**
   * Notify that an execution was approved or rejected.
   * Recipient: the employee who executed the card.
   */
  notifyApprovalResult(
    tenantId: number,
    card: TpmNotificationCard,
    executionUuid: string,
    executedBy: number,
    approved: boolean,
  ): void {
    const statusLabel = approved ? 'freigegeben' : 'abgelehnt';
    this.logger.log(
      `TPM approval ${statusLabel}: ${card.cardCode} (${card.uuid}), execution ${executionUuid}`,
    );
    eventBus.emitTpmApprovalResult(tenantId, this.toEventPayload(card), executionUuid, approved);

    void this.createPersistentNotification(
      tenantId,
      executedBy,
      `Wartung ${statusLabel}: ${card.cardCode}`,
      `Deine Durchführung von "${card.title}" wurde ${statusLabel}`,
      executedBy,
      card.uuid,
    );
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Convert card info to EventBus payload */
  private toEventPayload(card: TpmNotificationCard): TpmEvent['card'] {
    return {
      uuid: card.uuid,
      cardCode: card.cardCode,
      title: card.title,
      assetId: card.assetId,
      ...(card.assetName !== undefined && { assetName: card.assetName }),
      intervalType: card.intervalType,
      status: card.status,
    };
  }

  /**
   * Create persistent notification in DB (ADR-004 pattern).
   * Uses recipient_type='user' since TPM notifications are user-targeted.
   * Fails silently — notification is secondary to the business operation.
   */
  private async createPersistentNotification(
    tenantId: number,
    recipientId: number,
    title: string,
    message: string,
    createdBy: number,
    cardUuid: string,
  ): Promise<void> {
    try {
      const notificationUuid = uuidv7();
      await this.db.tenantQuery(
        `INSERT INTO notifications (
          tenant_id, type, title, message, priority,
          recipient_type, recipient_id, action_url, action_label,
          metadata, created_by, uuid, uuid_created_at
        ) VALUES ($1, 'tpm', $2, $3, 'normal', 'user', $4, $5, $6, $7, $8, $9, NOW())`,
        [
          tenantId,
          title,
          message,
          recipientId,
          '/lean-management/tpm',
          'Zum Board',
          JSON.stringify({ cardUuid }),
          createdBy,
          notificationUuid,
        ],
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to create persistent TPM notification: ${String(error)}`);
    }
  }
}
