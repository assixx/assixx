/**
 * Notification Statistics Service
 *
 * Sub-service handling notification analytics:
 * - Tenant-wide statistics (admin)
 * - Personal stats per user
 *
 * Called exclusively through the NotificationsService facade.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { rowsToRecord } from './notifications.helpers.js';
import type {
  DbCountRow,
  DbDateCountRow,
  DbPriorityCountRow,
  DbReadRateRow,
  DbTypeCountRow,
  NotificationStatisticsResponse,
  PersonalStatsResponse,
} from './notifications.types.js';

@Injectable()
export class NotificationStatisticsService {
  private readonly logger = new Logger(NotificationStatisticsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get notification statistics for a tenant (admin only).
   * Includes total, by-type, by-priority, read rate, and 30-day trends.
   */
  async getStatistics(tenantId: number): Promise<NotificationStatisticsResponse> {
    this.logger.debug(`Getting statistics for tenant ${tenantId}`);

    // Total count (PostgreSQL returns bigint as string)
    const totalRows = await this.db.tenantQuery<DbCountRow>(
      `SELECT COUNT(*) as total FROM notifications WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = Number.parseInt(totalRows[0]?.total ?? '0', 10);

    // By type
    const byTypeRows = await this.db.tenantQuery<DbTypeCountRow>(
      `SELECT type, COUNT(*) as count FROM notifications WHERE tenant_id = $1 GROUP BY type`,
      [tenantId],
    );
    const byType = rowsToRecord(byTypeRows, (r: DbTypeCountRow) => r.type);

    // By priority
    const byPriorityRows = await this.db.tenantQuery<DbPriorityCountRow>(
      `SELECT priority, COUNT(*) as count FROM notifications WHERE tenant_id = $1 GROUP BY priority`,
      [tenantId],
    );
    const byPriority = rowsToRecord(byPriorityRows, (r: DbPriorityCountRow) => r.priority);

    // Read rate
    const readRateRows = await this.db.tenantQuery<DbReadRateRow>(
      `SELECT COUNT(DISTINCT n.id) as total_notifications,
              COUNT(DISTINCT nrs.notification_id) as read_notifications
       FROM notifications n
       LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id
       WHERE n.tenant_id = $1`,
      [tenantId],
    );
    const readRateData = readRateRows[0];
    const totalNotifications = Number.parseInt(readRateData?.total_notifications ?? '0', 10);
    const readNotifications = Number.parseInt(readRateData?.read_notifications ?? '0', 10);
    const readRate = totalNotifications > 0 ? readNotifications / totalNotifications : 0;

    // Trends (last 30 days)
    const trendsRows = await this.db.tenantQuery<DbDateCountRow>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM notifications
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [tenantId],
    );

    return {
      total,
      byType,
      byPriority,
      readRate,
      trends: trendsRows.map((row: DbDateCountRow) => ({
        date: row.date,
        count: Number.parseInt(row.count, 10),
      })),
    };
  }

  /**
   * Get personal notification statistics for a user.
   * Includes total, unread count, and unread-by-type breakdown.
   */
  async getPersonalStats(userId: number, tenantId: number): Promise<PersonalStatsResponse> {
    // Total notifications for user
    const totalRows = await this.db.tenantQuery<DbCountRow>(
      `SELECT COUNT(*) as total FROM notifications n
       WHERE n.tenant_id = $1
       AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = $2)
            OR (n.recipient_type = 'department' AND n.recipient_id IN (
              SELECT ud.department_id FROM users u
              LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
              WHERE u.id = $2 AND u.tenant_id = $1))
            OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = $2 AND tenant_id = $1)))`,
      [tenantId, userId],
    );
    const total = Number.parseInt(totalRows[0]?.total ?? '0', 10);

    // Unread count
    const unreadRows = await this.db.tenantQuery<DbCountRow>(
      `SELECT COUNT(*) as unread_count FROM notifications n
       LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
       AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = $2)
            OR (n.recipient_type = 'department' AND n.recipient_id IN (
              SELECT ud.department_id FROM users u
              LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
              WHERE u.id = $2 AND u.tenant_id = $1))
            OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = $2 AND tenant_id = $1)))
       AND nrs.id IS NULL`,
      [tenantId, userId],
    );
    const unread = Number.parseInt(unreadRows[0]?.unread_count ?? '0', 10);

    // By type (UNREAD only - for badge counts)
    const byTypeRows = await this.db.tenantQuery<DbTypeCountRow>(
      `SELECT n.type, COUNT(*) as count FROM notifications n
       LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
       AND nrs.id IS NULL
       AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = $2)
            OR (n.recipient_type = 'department' AND n.recipient_id IN (
              SELECT ud.department_id FROM users u
              LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
              WHERE u.id = $2 AND u.tenant_id = $1))
            OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = $2 AND tenant_id = $1)))
       GROUP BY n.type`,
      [tenantId, userId],
    );
    const byType = rowsToRecord(byTypeRows, (r: DbTypeCountRow) => r.type);

    return { total, unread, byType };
  }
}
