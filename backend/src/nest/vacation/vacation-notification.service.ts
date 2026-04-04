/**
 * Vacation Notification Service
 *
 * Emits vacation lifecycle events via the EventBus for SSE delivery
 * AND creates persistent notifications in the DB (ADR-004 pattern).
 *
 * Persistent notifications enable:
 * - Sidebar badge counts (unread vacation notifications)
 * - Read/unread tracking via notification_read_status
 * - Dashboard counts aggregation
 *
 * Called by VacationService after successful status transitions.
 */
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { type VacationRequestEvent, eventBus } from '../../utils/event-bus.js';
import { DatabaseService } from '../database/database.service.js';
import type { VacationRequest } from './vacation.types.js';

@Injectable()
export class VacationNotificationService {
  private readonly logger = new Logger(VacationNotificationService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Build the EventBus payload from a VacationRequest domain object.
   * Only includes the fields needed for notification display.
   */
  private toEventPayload(request: VacationRequest): VacationRequestEvent['request'] {
    return {
      id: request.id,
      requesterId: request.requesterId,
      approverId: request.approverId,
      startDate: request.startDate,
      endDate: request.endDate,
      vacationType: request.vacationType,
      status: request.status,
      computedDays: request.computedDays,
      requesterName: request.requesterName,
      approverName: request.approverName,
    };
  }

  /**
   * Notify that a new vacation request was created.
   * Recipient: the approver who needs to respond.
   * Skipped for auto-approved requests (no approver to notify).
   */
  notifyCreated(tenantId: number, request: VacationRequest): void {
    this.logger.log(
      `Vacation request created: ${request.id} by user ${String(request.requesterId)}`,
    );
    eventBus.emitVacationRequestCreated(tenantId, this.toEventPayload(request));

    // Only create persistent notification if there's an approver (not auto-approved)
    if (request.approverId !== null) {
      void this.createPersistentNotification(
        tenantId,
        request.approverId,
        `Neuer Urlaubsantrag`,
        `${request.requesterName ?? `Mitarbeiter #${String(request.requesterId)}`} hat einen Urlaubsantrag eingereicht (${request.startDate} – ${request.endDate}, ${String(request.computedDays)} Tage)`,
        request.requesterId,
        request.id,
        '/vacation',
        'Antrag ansehen',
      );
    }
    this.sendEmailStub('created', tenantId, request);
  }

  /**
   * Notify that a vacation request was approved or denied.
   * Recipient: the requester who submitted the request.
   */
  notifyResponded(tenantId: number, request: VacationRequest): void {
    this.logger.log(
      `Vacation request ${request.status}: ${request.id} by approver ${String(request.respondedBy)}`,
    );
    eventBus.emitVacationRequestResponded(tenantId, this.toEventPayload(request));

    const statusLabel = request.status === 'approved' ? 'genehmigt' : 'abgelehnt';
    void this.createPersistentNotification(
      tenantId,
      request.requesterId,
      `Urlaubsantrag ${statusLabel}`,
      `Dein Urlaubsantrag (${request.startDate} – ${request.endDate}, ${String(request.computedDays)} Tage) wurde ${statusLabel}.${request.responseNote !== null ? ` Grund: ${request.responseNote}` : ''}`,
      request.respondedBy ?? request.requesterId,
      request.id,
      '/vacation',
      'Details ansehen',
    );
    this.sendEmailStub('responded', tenantId, request);
  }

  /**
   * Notify that a vacation request was withdrawn by the requester.
   * Recipient: the approver (if assigned).
   */
  notifyWithdrawn(
    tenantId: number,
    requestId: string,
    requesterId: number,
    approverId: number | null,
    requesterName: string | undefined,
  ): void {
    this.logger.log(`Vacation request withdrawn: ${requestId} by user ${String(requesterId)}`);
    eventBus.emitVacationRequestWithdrawn(tenantId, {
      id: requestId,
      requesterId,
      approverId,
      startDate: '',
      endDate: '',
      vacationType: 'regular',
      status: 'withdrawn',
      computedDays: 0,
    });

    if (approverId !== null) {
      void this.createPersistentNotification(
        tenantId,
        approverId,
        'Urlaubsantrag zurückgezogen',
        `${requesterName ?? `Mitarbeiter #${String(requesterId)}`} hat einen Urlaubsantrag zurückgezogen.`,
        requesterId,
        requestId,
        '/vacation',
        'Details ansehen',
      );
    }
  }

  /**
   * Notify that an approved vacation request was cancelled by admin.
   * Recipient: the requester whose vacation was cancelled.
   */
  notifyCancelled(
    tenantId: number,
    requestId: string,
    requesterId: number,
    adminId: number,
    reason: string,
  ): void {
    this.logger.log(`Vacation request cancelled: ${requestId} by admin ${String(adminId)}`);
    eventBus.emitVacationRequestCancelled(tenantId, {
      id: requestId,
      requesterId,
      approverId: null,
      startDate: '',
      endDate: '',
      vacationType: 'regular',
      status: 'cancelled',
      computedDays: 0,
    });

    void this.createPersistentNotification(
      tenantId,
      requesterId,
      'Urlaubsantrag storniert',
      `Dein genehmigter Urlaubsantrag wurde storniert.${reason !== '' ? ` Grund: ${reason}` : ''}`,
      adminId,
      requestId,
      '/vacation',
      'Details ansehen',
    );
  }

  // ==========================================================================
  // Private — Persistent notification (ADR-004 pattern)
  // ==========================================================================

  /**
   * Create a persistent notification in the DB for badge counts + read tracking.
   * Uses recipient_type='user' since vacation notifications are always user-targeted.
   * Fails silently (logs error) — notification is secondary to the business operation.
   */
  private async createPersistentNotification(
    tenantId: number,
    recipientId: number,
    title: string,
    message: string,
    createdBy: number,
    requestId: string,
    actionUrl: string,
    actionLabel: string,
  ): Promise<void> {
    try {
      const notificationUuid = uuidv7();
      await this.db.tenantQuery(
        `INSERT INTO notifications (
          tenant_id, type, title, message, priority,
          recipient_type, recipient_id, action_url, action_label,
          metadata, created_by, uuid, uuid_created_at
        ) VALUES ($1, 'vacation', $2, $3, 'normal', 'user', $4, $5, $6, $7, $8, $9, NOW())`,
        [
          tenantId,
          title,
          message,
          recipientId,
          actionUrl,
          actionLabel,
          JSON.stringify({ requestId }),
          createdBy,
          notificationUuid,
        ],
      );
      this.logger.log(`Created persistent vacation notification for user ${String(recipientId)}`);
    } catch (error: unknown) {
      // Log but don't fail — notification is secondary to the business operation
      this.logger.error(`Failed to create persistent vacation notification: ${String(error)}`);
    }
  }

  /**
   * Email notification stub — logs intent, no actual email sent.
   * Will be replaced with real email integration in a future session.
   */
  private sendEmailStub(action: string, tenantId: number, request: VacationRequest): void {
    this.logger.debug(
      `[EMAIL STUB] Would send '${action}' email for request ${request.id} ` +
        `(tenant ${String(tenantId)}, requester ${String(request.requesterId)})`,
    );
  }
}
