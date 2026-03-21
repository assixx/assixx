/**
 * TPM Dashboard Service
 *
 * Provides count aggregation for the main dashboard.
 * Counts unread TPM notifications targeted at the current user.
 *
 * Pattern: Same as vacation count in dashboard.service.ts —
 * direct DB query against notifications table, type='tpm'.
 */
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class TpmDashboardService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Count unread TPM notifications for a user.
   *
   * Queries persistent notifications of type='tpm' targeted at the user
   * that have not been marked as read (no entry in notification_read_status).
   */
  async getUnreadCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications n
       LEFT JOIN notification_read_status nrs
         ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
         AND n.type = 'tpm'
         AND n.recipient_type = 'user'
         AND n.recipient_id = $2
         AND nrs.id IS NULL`,
      [tenantId, userId],
    );
    return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
  }
}
