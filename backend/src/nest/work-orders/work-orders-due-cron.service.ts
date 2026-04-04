/**
 * Work Orders Due Date Cron Service
 *
 * Runs daily at 07:00 Europe/Berlin to detect work orders
 * that are due within 24 hours and sends notifications.
 *
 * Uses a `due_soon_notified_at` flag to prevent duplicate notifications.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DatabaseService } from '../database/database.service.js';
import { WorkOrderNotificationService } from './work-orders-notification.service.js';

interface DueSoonRow {
  uuid: string;
  tenant_id: number;
}

@Injectable()
export class WorkOrderDueCronService {
  private readonly logger = new Logger(WorkOrderDueCronService.name);
  private isProcessing = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: WorkOrderNotificationService,
  ) {}

  /** Cron: 07:00 Europe/Berlin daily */
  @Cron('0 7 * * *', {
    name: 'work-orders-due-soon',
    timeZone: 'Europe/Berlin',
  })
  async handleDueSoonCheck(): Promise<void> {
    await this.processDueSoon();
  }

  private async processDueSoon(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const rows = await this.db.systemQuery<DueSoonRow>(
        `SELECT uuid, tenant_id FROM work_orders
         WHERE is_active = ${IS_ACTIVE.ACTIVE}
           AND status IN ('open', 'in_progress')
           AND due_date IS NOT NULL
           AND due_date <= NOW() + INTERVAL '24 hours'
           AND due_date > NOW()
           AND due_soon_notified_at IS NULL`,
        [],
      );

      if (rows.length === 0) {
        this.logger.debug('Keine bald fälligen Arbeitsaufträge gefunden');
        return;
      }

      this.logger.log(
        `${rows.length} Arbeitsauftrag/Aufträge bald fällig — sende Benachrichtigungen`,
      );

      for (const row of rows) {
        await this.notifications.notifyDueSoon(row.tenant_id, row.uuid.trim());

        await this.db.systemQuery(
          `UPDATE work_orders SET due_soon_notified_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
          [row.uuid, row.tenant_id],
        );
      }

      this.logger.log(`${rows.length} Fälligkeits-Benachrichtigungen gesendet`);
    } catch (error: unknown) {
      this.logger.error('Fehler beim Prüfen fälliger Arbeitsaufträge', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
