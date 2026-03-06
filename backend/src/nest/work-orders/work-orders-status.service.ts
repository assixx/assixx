/**
 * Work Orders Status Service
 *
 * Handles validated status transitions with automatic comment creation.
 * Uses FOR UPDATE lock to prevent race conditions.
 *
 * Transition Matrix:
 *   open → in_progress | completed
 *   in_progress → completed
 *   completed → verified | in_progress
 *   verified → completed
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { isValidStatusTransition } from './work-orders.helpers.js';
import type { WorkOrderStatus } from './work-orders.types.js';
import { STATUS_LABELS } from './work-orders.types.js';

@Injectable()
export class WorkOrderStatusService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Update status with validated transition + automatic comment */
  async updateStatus(
    tenantId: number,
    userId: number,
    workOrderUuid: string,
    newStatus: WorkOrderStatus,
  ): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const wo = await this.lockAndValidate(
          client,
          tenantId,
          workOrderUuid,
          newStatus,
        );

        await this.applyStatusUpdate(client, wo.id, newStatus);
        await this.insertStatusComment(
          client,
          tenantId,
          wo.id,
          userId,
          wo.status,
          newStatus,
        );

        void this.activityLogger.logUpdate(
          tenantId,
          userId,
          'work_order',
          wo.id,
          `Status von "${STATUS_LABELS[wo.status]}" zu "${STATUS_LABELS[newStatus]}" geändert`,
          { status: wo.status },
          { status: newStatus },
        );
      },
    );
  }

  /** Admin: verify a completed work order */
  async verifyWorkOrder(
    tenantId: number,
    adminUserId: number,
    workOrderUuid: string,
  ): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const wo = await this.lockAndValidate(
          client,
          tenantId,
          workOrderUuid,
          'verified',
        );

        await client.query(
          `UPDATE work_orders
           SET status = 'verified', verified_at = NOW(), verified_by = $1
           WHERE id = $2`,
          [adminUserId, wo.id],
        );

        await this.insertStatusComment(
          client,
          tenantId,
          wo.id,
          adminUserId,
          wo.status,
          'verified',
        );

        void this.activityLogger.logUpdate(
          tenantId,
          adminUserId,
          'work_order',
          wo.id,
          `Arbeitsauftrag "${wo.title}" verifiziert`,
          { status: wo.status },
          { status: 'verified', verifiedBy: adminUserId },
        );
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Lock row + validate transition */
  private async lockAndValidate(
    client: PoolClient,
    tenantId: number,
    uuid: string,
    newStatus: WorkOrderStatus,
  ): Promise<{ id: number; status: WorkOrderStatus; title: string }> {
    const result = await client.query<{
      id: number;
      status: WorkOrderStatus;
      title: string;
    }>(
      `SELECT id, status, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [uuid, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    const wo = result.rows[0];

    if (!isValidStatusTransition(wo.status, newStatus)) {
      throw new BadRequestException(
        `Ungültiger Statusübergang: ${STATUS_LABELS[wo.status]} → ${STATUS_LABELS[newStatus]}`,
      );
    }

    return wo;
  }

  /** Apply status UPDATE (without verified fields) */
  private async applyStatusUpdate(
    client: PoolClient,
    workOrderId: number,
    newStatus: WorkOrderStatus,
  ): Promise<void> {
    const completedAt = newStatus === 'completed' ? 'NOW()' : 'completed_at';

    await client.query(
      `UPDATE work_orders
       SET status = $1, completed_at = ${completedAt}
       WHERE id = $2`,
      [newStatus, workOrderId],
    );
  }

  /** Insert automatic status-change comment */
  private async insertStatusComment(
    client: PoolClient,
    tenantId: number,
    workOrderId: number,
    userId: number,
    oldStatus: WorkOrderStatus,
    newStatus: WorkOrderStatus,
  ): Promise<void> {
    await client.query(
      `INSERT INTO work_order_comments
         (uuid, tenant_id, work_order_id, user_id, content, is_status_change, old_status, new_status)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        uuidv7(),
        tenantId,
        workOrderId,
        userId,
        `Status geändert: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`,
        oldStatus,
        newStatus,
      ],
    );
  }
}
