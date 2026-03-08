/**
 * Work Orders Notification Service
 *
 * Emits SSE events via EventBus for real-time notifications
 * AND creates persistent DB notifications for assignment + verification.
 * Fire-and-forget pattern — errors are logged, never thrown.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { DatabaseService } from '../database/database.service.js';
import type { WorkOrderStatus } from './work-orders.types.js';

@Injectable()
export class WorkOrderNotificationService {
  private readonly logger = new Logger(WorkOrderNotificationService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Notify assignees that they were assigned to a work order */
  async notifyAssigned(
    tenantId: number,
    workOrderUuid: string,
    assigneeUserIds: number[],
  ): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    eventBus.emitWorkOrderAssigned(tenantId, {
      ...wo,
      assigneeUserIds,
    });
  }

  /** Notify relevant users that the status changed */
  async notifyStatusChanged(
    tenantId: number,
    workOrderUuid: string,
    newStatus: WorkOrderStatus,
    changedByUserId: number,
  ): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    eventBus.emitWorkOrderStatusChanged(
      tenantId,
      { ...wo, status: newStatus },
      changedByUserId,
    );
  }

  /** Notify that a work order is due soon (called from cron) */
  async notifyDueSoon(tenantId: number, workOrderUuid: string): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    eventBus.emitWorkOrderDueSoon(tenantId, wo);
  }

  /** Notify that a work order was verified */
  async notifyVerified(
    tenantId: number,
    workOrderUuid: string,
    verifiedByUserId: number,
  ): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    eventBus.emitWorkOrderVerified(tenantId, wo, verifiedByUserId);
  }

  // ==========================================================================
  // Persistent DB Notifications
  // ==========================================================================

  /** Create persistent DB notification for each assignee */
  async persistAssignedNotification(
    tenantId: number,
    workOrderUuid: string,
    assigneeUserIds: number[],
    createdByUserId: number,
  ): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    await this.insertNotificationsForUsers(
      tenantId,
      assigneeUserIds,
      'work_orders',
      `Neuer Arbeitsauftrag: ${wo.title}`,
      `Dir wurde der Arbeitsauftrag "${wo.title}" (Priorität: ${wo.priority}) zugewiesen.`,
      createdByUserId,
      { entityUuid: workOrderUuid },
    );
  }

  /** Create persistent DB notification for assignees when verified */
  async persistVerifiedNotification(
    tenantId: number,
    workOrderUuid: string,
    verifiedByUserId: number,
  ): Promise<void> {
    const wo = await this.loadWorkOrderPayload(tenantId, workOrderUuid);
    if (wo === null) return;

    await this.insertNotificationsForUsers(
      tenantId,
      wo.assigneeUserIds,
      'work_orders',
      `Arbeitsauftrag verifiziert: ${wo.title}`,
      `Dein Arbeitsauftrag "${wo.title}" wurde verifiziert.`,
      verifiedByUserId,
      { entityUuid: workOrderUuid },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Insert one notification per target user (fire-and-forget) */
  private async insertNotificationsForUsers(
    tenantId: number,
    userIds: number[],
    type: string,
    title: string,
    message: string,
    createdBy: number,
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    if (userIds.length === 0) return;

    try {
      const colsPerRow = 8;
      await this.db.transaction(
        async (client: import('pg').PoolClient) => {
          const values = userIds.map(
            (_uid: number, i: number): string =>
              `($${i * colsPerRow + 1}, $${i * colsPerRow + 2}, $${i * colsPerRow + 3}, $${i * colsPerRow + 4}, $${i * colsPerRow + 5}, $${i * colsPerRow + 6}, $${i * colsPerRow + 7}, $${i * colsPerRow + 8})`,
          );

          const metadataJson =
            metadata !== null ? JSON.stringify(metadata) : null;
          const params = userIds.flatMap((uid: number): unknown[] => [
            tenantId,
            type,
            title,
            message,
            'user',
            uid,
            createdBy,
            metadataJson,
          ]);

          const sql = `INSERT INTO notifications
             (tenant_id, type, title, message, recipient_type, recipient_id, created_by, metadata, uuid, uuid_created_at)
           VALUES ${values.map((v: string, i: number): string => v.replace(/\)$/, `, $${userIds.length * colsPerRow + i * 2 + 1}, NOW())`)).join(', ')}`;

          await client.query(sql, [
            ...params,
            ...userIds.map((): string => uuidv7()),
          ]);
        },
        { tenantId },
      );
    } catch (error: unknown) {
      this.logger.error(
        'Fehler beim Erstellen persistenter Benachrichtigungen',
        error,
      );
    }
  }

  private async loadWorkOrderPayload(
    tenantId: number,
    uuid: string,
  ): Promise<{
    uuid: string;
    title: string;
    status: string;
    priority: string;
    assigneeUserIds: number[];
  } | null> {
    try {
      const row = await this.db.queryOne<{
        uuid: string;
        title: string;
        status: string;
        priority: string;
      }>(
        `SELECT uuid, title, status, priority FROM work_orders
         WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [uuid, tenantId],
      );

      if (row === null) return null;

      const assignees = await this.db.query<{ user_id: number }>(
        `SELECT user_id FROM work_order_assignees
         WHERE work_order_id = (SELECT id FROM work_orders WHERE uuid = $1 AND tenant_id = $2)`,
        [uuid, tenantId],
      );

      return {
        uuid: row.uuid.trim(),
        title: row.title,
        status: row.status,
        priority: row.priority,
        assigneeUserIds: assignees.map(
          (a: { user_id: number }): number => a.user_id,
        ),
      };
    } catch (error: unknown) {
      this.logger.error(
        `Fehler beim Laden der Benachrichtigungsdaten für ${uuid}`,
        error,
      );
      return null;
    }
  }
}
