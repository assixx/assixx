/**
 * Notification Preferences Service
 *
 * Sub-service handling user notification preference CRUD.
 * Operates on the notification_preferences table.
 *
 * Called exclusively through the NotificationsService facade.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
  DbIdRow,
  DbNotificationPreferencesRow,
  NotificationPreferencesResponse,
} from './notifications.types.js';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get notification preferences for a user.
   * Returns defaults if no preferences exist.
   */
  async getPreferences(userId: number, tenantId: number): Promise<NotificationPreferencesResponse> {
    this.logger.debug(`Getting preferences for user ${userId}`);

    const rows = await this.db.query<DbNotificationPreferencesRow>(
      `SELECT * FROM notification_preferences
       WHERE user_id = $1 AND tenant_id = $2 AND notification_type = 'general'`,
      [userId, tenantId],
    );

    const prefs = rows[0];
    if (prefs === undefined) {
      return this.getDefaultPreferences();
    }

    let notificationTypes: Record<string, { email: boolean; push: boolean; sms: boolean }> = {};
    if (prefs.preferences !== null) {
      try {
        notificationTypes =
          typeof prefs.preferences === 'string' ?
            (JSON.parse(prefs.preferences) as Record<
              string,
              { email: boolean; push: boolean; sms: boolean }
            >)
          : (prefs.preferences as Record<string, { email: boolean; push: boolean; sms: boolean }>);
      } catch {
        this.logger.warn('Failed to parse notification preferences JSON');
        notificationTypes = {};
      }
    }

    return {
      emailNotifications: prefs.email_notifications === 1,
      pushNotifications: prefs.push_notifications === 1,
      smsNotifications: prefs.sms_notifications === 1,
      notificationTypes,
    };
  }

  /**
   * Upsert notification preferences in database.
   * Audit logging is handled by the facade.
   */
  async upsertPreferences(
    userId: number,
    tenantId: number,
    emailNotifications: boolean,
    pushNotifications: boolean,
    smsNotifications: boolean,
    notificationTypesJson: string,
  ): Promise<void> {
    const existing = await this.db.query<DbIdRow>(
      `SELECT id FROM notification_preferences
       WHERE user_id = $1 AND tenant_id = $2 AND notification_type = 'general'`,
      [userId, tenantId],
    );

    if (existing.length > 0) {
      await this.db.query(
        `UPDATE notification_preferences
         SET email_notifications = $1, push_notifications = $2, sms_notifications = $3,
             preferences = $4, updated_at = NOW()
         WHERE user_id = $5 AND tenant_id = $6 AND notification_type = 'general'`,
        [
          emailNotifications,
          pushNotifications,
          smsNotifications,
          notificationTypesJson,
          userId,
          tenantId,
        ],
      );
    } else {
      await this.db.query(
        `INSERT INTO notification_preferences
         (user_id, tenant_id, email_notifications, push_notifications, sms_notifications, preferences, notification_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'general')`,
        [
          userId,
          tenantId,
          emailNotifications,
          pushNotifications,
          smsNotifications,
          notificationTypesJson,
        ],
      );
    }
  }

  /** Get default notification preferences */
  private getDefaultPreferences(): NotificationPreferencesResponse {
    return {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      notificationTypes: {
        system: { email: true, push: true, sms: false },
        task: { email: true, push: true, sms: false },
        message: { email: false, push: true, sms: false },
        announcement: { email: true, push: true, sms: false },
      },
    };
  }
}
