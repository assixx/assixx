/**
 * Notification Feature Service
 *
 * Sub-service handling feature-specific notifications (ADR-004):
 * - Create notifications when surveys/documents/KVP items are created
 * - Batch mark-as-read when user visits a feature page
 *
 * Called by NotificationsService facade.
 * Consumers: SurveysService, DocumentsService, KvpService (via facade).
 */
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class NotificationFeatureService {
  private readonly logger = new Logger(NotificationFeatureService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create notification for a feature event (survey, document, kvp).
   * Uses ON CONFLICT DO NOTHING to prevent duplicates.
   */
  async createFeatureNotification(
    type: 'survey' | 'document' | 'kvp' | 'vacation',
    featureId: number,
    title: string,
    message: string,
    recipientType: 'user' | 'department' | 'team' | 'all',
    recipientId: number | null,
    tenantId: number,
    createdBy: number,
  ): Promise<void> {
    try {
      const notificationUuid = uuidv7();
      await this.db.query(
        `INSERT INTO notifications (
          tenant_id, type, title, message, priority,
          recipient_type, recipient_id, feature_id,
          created_by, uuid, uuid_created_at
        ) VALUES ($1, $2, $3, $4, 'normal', $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id, type, feature_id, recipient_type, COALESCE(recipient_id, 0))
        WHERE feature_id IS NOT NULL
        DO NOTHING`,
        [
          tenantId,
          type,
          title,
          message,
          recipientType,
          recipientId,
          featureId,
          createdBy,
          notificationUuid,
        ],
      );
      this.logger.log(`Created ${type} notification for feature ${featureId}`);
    } catch (error) {
      // Log but don't fail - notification is secondary to feature creation
      this.logger.error(
        `Failed to create ${type} notification: ${String(error)}`,
      );
    }
  }

  /**
   * Mark all notifications of a feature type as read for a user.
   * Called when user visits the feature page (e.g., /surveys).
   */
  async markFeatureTypeAsRead(
    type: 'survey' | 'document' | 'kvp' | 'vacation' | 'tpm',
    userId: number,
    tenantId: number,
  ): Promise<number> {
    this.logger.log(
      `Marking all ${type} notifications as read for user ${userId}`,
    );

    const result = await this.db.query<{ id: number }>(
      `WITH unread_notifications AS (
        SELECT n.id FROM notifications n
        LEFT JOIN notification_read_status nrs
          ON n.id = nrs.notification_id AND nrs.user_id = $2
        WHERE n.tenant_id = $1
          AND n.type = $3
          AND nrs.id IS NULL
          AND (n.recipient_type = 'all'
               OR (n.recipient_type = 'user' AND n.recipient_id = $2)
               OR (n.recipient_type = 'department' AND n.recipient_id IN
                   (SELECT ud.department_id FROM users u
                    LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
                    WHERE u.id = $2 AND u.tenant_id = $1))
               OR (n.recipient_type = 'team' AND n.recipient_id IN
                   (SELECT team_id FROM user_teams WHERE user_id = $2 AND tenant_id = $1)))
      )
      INSERT INTO notification_read_status (notification_id, user_id, tenant_id, read_at)
      SELECT id, $2, $1, NOW() FROM unread_notifications
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [tenantId, userId, type],
    );

    this.logger.log(`Marked ${result.length} ${type} notifications as read`);
    return result.length;
  }
}
