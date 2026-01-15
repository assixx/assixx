/**
 * Notifications Service (NestJS)
 *
 * Native NestJS implementation for notification management.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateNotificationDto } from './dto/create-notification.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CODES = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbNotificationRow extends QueryResultRow {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  recipient_type: string;
  recipient_id: number | null;
  action_url: string | null;
  action_label: string | null;
  metadata: string | null;
  scheduled_for: string | null;
  created_by: number;
  tenant_id: number;
  created_at: Date;
  updated_at: Date;
  // From JOINs
  read_at?: Date | null;
  is_read?: boolean;
  created_by_name?: string;
}

interface DbNotificationPreferencesRow extends QueryResultRow {
  id: number;
  user_id: number;
  tenant_id: number;
  notification_type: string;
  email_notifications: number;
  push_notifications: number;
  sms_notifications: number;
  preferences: string | Record<string, unknown> | null;
}

interface DbIdRow extends QueryResultRow {
  id: number;
}

interface DbCountRow extends QueryResultRow {
  total?: number;
  count?: number;
  unread_count?: number;
}

interface DbTypeCountRow extends QueryResultRow {
  type: string;
  count: number;
}

interface DbPriorityCountRow extends QueryResultRow {
  priority: string;
  count: number;
}

interface DbReadRateRow extends QueryResultRow {
  total_notifications: number;
  read_notifications: number;
}

interface DbDateCountRow extends QueryResultRow {
  date: string;
  count: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Notification data for API response
 */
export interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  recipientType: string;
  recipientId: number | null;
  actionUrl: string | null;
  actionLabel: string | null;
  metadata: Record<string, unknown> | null;
  scheduledFor: string | null;
  createdBy: number;
  createdByName?: string | undefined;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null | undefined;
  isRead?: boolean | undefined;
}

/**
 * Paginated notifications result
 */
export interface PaginatedNotificationsResult {
  notifications: NotificationResponse[];
  total: number;
  page: number;
  totalPages: number;
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Notification preferences response
 */
export interface NotificationPreferencesResponse {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  notificationTypes: Record<string, { email: boolean; push: boolean; sms: boolean }>;
}

/**
 * Notification statistics response
 */
export interface NotificationStatisticsResponse {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  readRate: number;
  trends: { date: string; count: number }[];
}

/**
 * Personal stats response
 */
export interface PersonalStatsResponse {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

/**
 * Notification filters for listing
 */
export interface NotificationFilters {
  type?: string | undefined;
  priority?: string | undefined;
  unread?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ==========================================================================
  // MAIN OPERATIONS
  // ==========================================================================

  /**
   * List notifications for a user with filters
   */
  async listNotifications(
    userId: number,
    tenantId: number,
    filters: NotificationFilters,
  ): Promise<PaginatedNotificationsResult> {
    this.logger.log(`Listing notifications for user ${userId} in tenant ${tenantId}`);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const { conditions, params } = this.buildNotificationConditions(userId, tenantId, filters);

    // Build main query with dynamic parameter indices
    const userIdParamIndex = params.length + 1;
    const limitParamIndex = params.length + 2;
    const offsetParamIndex = params.length + 3;

    const query = `
      SELECT n.*, nrs.read_at,
        CASE WHEN nrs.id IS NOT NULL THEN true ELSE false END as is_read,
        u.username as created_by_name
      FROM notifications n
      LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $${userIdParamIndex}
      LEFT JOIN users u ON n.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ${filters.unread === true ? 'AND nrs.id IS NULL' : ''}
      ORDER BY n.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const rows = await this.db.query<DbNotificationRow>(query, [...params, userId, limit, offset]);

    const { total, unreadCount } = await this.getNotificationCounts(
      userId,
      conditions,
      params,
      filters,
    );
    const totalPages = Math.ceil(total / limit);

    return {
      notifications: rows.map((row: DbNotificationRow) => this.mapNotificationToApi(row)),
      total,
      page,
      totalPages,
      unreadCount,
      pagination: { page, limit, total, totalPages },
    };
  }

  /**
   * Create a new notification (admin only)
   */
  async createNotification(
    dto: CreateNotificationDto,
    createdBy: number,
    tenantId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ notificationId: number }> {
    this.logger.log(`Creating notification: ${dto.title}`);

    const notificationUuid = uuidv7();
    const rows = await this.db.query<DbIdRow>(
      `INSERT INTO notifications
       (type, title, message, priority, recipient_id, recipient_type, action_url, action_label,
        metadata, scheduled_for, created_by, tenant_id, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING id`,
      [
        dto.type,
        dto.title,
        dto.message,
        dto.priority ?? 'normal',
        dto.recipientId ?? null,
        dto.recipientType,
        dto.actionUrl ?? null,
        dto.actionLabel ?? null,
        dto.metadata !== undefined ? JSON.stringify(dto.metadata) : null,
        dto.scheduledFor ?? null,
        createdBy,
        tenantId,
        notificationUuid,
      ],
    );

    const insertedId = rows[0]?.id;
    if (insertedId === undefined) {
      throw new BadRequestException('Failed to create notification');
    }

    // Audit log
    await this.createAuditLog(
      'notification_created',
      createdBy,
      tenantId,
      'notification',
      insertedId,
      {
        type: dto.type,
        title: dto.title,
        recipientType: dto.recipientType,
        recipientId: dto.recipientId,
      },
      ipAddress,
      userAgent,
    );

    return { notificationId: insertedId };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number, tenantId: number): Promise<void> {
    this.logger.log(`Marking notification ${notificationId} as read for user ${userId}`);

    // Check if notification exists and user has access
    const rows = await this.db.query<DbNotificationRow>(
      `SELECT * FROM notifications
       WHERE id = $1 AND tenant_id = $2
       AND (recipient_type = 'all' OR (recipient_type = 'user' AND recipient_id = $3)
            OR (recipient_type = 'department' AND recipient_id IN (
              SELECT ud.department_id FROM users u
              LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
              WHERE u.id = $3 AND u.tenant_id = $2))
            OR (recipient_type = 'team' AND recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = $3 AND tenant_id = $2)))`,
      [notificationId, tenantId, userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    // Mark as read (INSERT ON CONFLICT DO NOTHING)
    await this.db.query(
      `INSERT INTO notification_read_status (notification_id, user_id, tenant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [notificationId, userId, tenantId],
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: number, tenantId: number): Promise<{ updated: number }> {
    this.logger.log(`Marking all notifications as read for user ${userId}`);

    // Get all unread notifications for user
    const unreadNotifications = await this.db.query<DbIdRow>(
      `SELECT n.id FROM notifications n
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

    let markedCount = 0;
    for (const notification of unreadNotifications) {
      await this.db.query(
        `INSERT INTO notification_read_status (notification_id, user_id, tenant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [notification.id, userId, tenantId],
      );
      markedCount++;
    }

    return { updated: markedCount };
  }

  /**
   * Delete notification
   */
  async deleteNotification(
    notificationId: number,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deleting notification ${notificationId}`);

    // Check if notification exists
    const rows = await this.db.query<DbNotificationRow>(
      `SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2`,
      [notificationId, tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    const notification = rows[0];
    if (notification === undefined) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    // Check permissions - admin can delete any, users only their own
    if (
      userRole !== 'admin' &&
      userRole !== 'root' &&
      (notification.recipient_type !== 'user' || notification.recipient_id !== userId)
    ) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    // Delete notification
    await this.db.query(`DELETE FROM notifications WHERE id = $1 AND tenant_id = $2`, [
      notificationId,
      tenantId,
    ]);

    // Audit log
    await this.createAuditLog(
      'notification_deleted',
      userId,
      tenantId,
      'notification',
      notificationId,
      { deletedNotification: { id: notificationId, type: notification.type } },
      ipAddress,
      userAgent,
    );
  }

  // ==========================================================================
  // PREFERENCES
  // ==========================================================================

  /**
   * Get notification preferences
   */
  async getPreferences(userId: number, tenantId: number): Promise<NotificationPreferencesResponse> {
    this.logger.log(`Getting preferences for user ${userId}`);

    const rows = await this.db.query<DbNotificationPreferencesRow>(
      `SELECT * FROM notification_preferences
       WHERE user_id = $1 AND tenant_id = $2 AND notification_type = 'general'`,
      [userId, tenantId],
    );

    // Return default preferences if none exist
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
   * Update notification preferences
   */
  async updatePreferences(
    userId: number,
    tenantId: number,
    dto: UpdatePreferencesDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Updating preferences for user ${userId}`);

    const emailNotifications = dto.emailNotifications ?? true;
    const pushNotifications = dto.pushNotifications ?? true;
    const smsNotifications = dto.smsNotifications ?? false;
    const notificationTypesJson = JSON.stringify(dto.notificationTypes ?? {});

    await this.upsertPreferencesInDb(
      userId,
      tenantId,
      emailNotifications,
      pushNotifications,
      smsNotifications,
      notificationTypesJson,
    );

    await this.createAuditLog(
      'notification_preferences_updated',
      userId,
      tenantId,
      'user',
      userId,
      {
        emailNotifications,
        pushNotifications,
        smsNotifications,
        notificationTypes: dto.notificationTypes,
      },
      ipAddress,
      userAgent,
    );
  }

  /** Upsert notification preferences in database */
  private async upsertPreferencesInDb(
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

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get notification statistics (admin only)
   */
  async getStatistics(tenantId: number): Promise<NotificationStatisticsResponse> {
    this.logger.log(`Getting statistics for tenant ${tenantId}`);

    // Total count
    const totalRows = await this.db.query<DbCountRow>(
      `SELECT COUNT(*) as total FROM notifications WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = totalRows[0]?.total ?? 0;

    // By type
    const byTypeRows = await this.db.query<DbTypeCountRow>(
      `SELECT type, COUNT(*) as count FROM notifications WHERE tenant_id = $1 GROUP BY type`,
      [tenantId],
    );
    const byType = this.rowsToRecord(byTypeRows, (r: DbTypeCountRow) => r.type);

    // By priority
    const byPriorityRows = await this.db.query<DbPriorityCountRow>(
      `SELECT priority, COUNT(*) as count FROM notifications WHERE tenant_id = $1 GROUP BY priority`,
      [tenantId],
    );
    const byPriority = this.rowsToRecord(byPriorityRows, (r: DbPriorityCountRow) => r.priority);

    // Read rate
    const readRateRows = await this.db.query<DbReadRateRow>(
      `SELECT COUNT(DISTINCT n.id) as total_notifications,
              COUNT(DISTINCT nrs.notification_id) as read_notifications
       FROM notifications n
       LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id
       WHERE n.tenant_id = $1`,
      [tenantId],
    );
    const readRateData = readRateRows[0];
    const readRate =
      readRateData !== undefined && readRateData.total_notifications > 0 ?
        readRateData.read_notifications / readRateData.total_notifications
      : 0;

    // Trends (last 30 days)
    const trendsRows = await this.db.query<DbDateCountRow>(
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
      trends: trendsRows.map((row: DbDateCountRow) => ({ date: row.date, count: row.count })),
    };
  }

  /**
   * Get personal notification statistics
   */
  async getPersonalStats(userId: number, tenantId: number): Promise<PersonalStatsResponse> {
    this.logger.log(`Getting personal stats for user ${userId}`);

    // Total notifications for user
    const totalRows = await this.db.query<DbCountRow>(
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
    const total = totalRows[0]?.total ?? 0;

    // Unread count
    const unreadRows = await this.db.query<DbCountRow>(
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
    const unread = unreadRows[0]?.unread_count ?? 0;

    // By type (UNREAD only - for badge counts)
    const byTypeRows = await this.db.query<DbTypeCountRow>(
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
    const byType = this.rowsToRecord(byTypeRows, (r: DbTypeCountRow) => r.type);

    return { total, unread, byType };
  }

  // ==========================================================================
  // FEATURE NOTIFICATIONS (ADR-004)
  // ==========================================================================

  /**
   * Create notification for feature event (survey, document, kvp)
   * Called by SurveysService, DocumentsService, KvpService when creating items.
   *
   * @param type - 'survey' | 'document' | 'kvp'
   * @param featureId - ID of the created feature
   * @param title - Notification title
   * @param message - Notification message
   * @param recipientType - 'user' | 'department' | 'team' | 'all'
   * @param recipientId - ID of recipient (null for 'all')
   * @param tenantId - Tenant ID
   * @param createdBy - User ID who created the feature
   */
  async createFeatureNotification(
    type: 'survey' | 'document' | 'kvp',
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
      this.logger.error(`Failed to create ${type} notification: ${String(error)}`);
    }
  }

  /**
   * Mark all notifications of a feature type as read for a user.
   * Called when user visits the feature page (e.g., /surveys).
   *
   * @param type - 'survey' | 'document' | 'kvp'
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Number of notifications marked as read
   */
  async markFeatureTypeAsRead(
    type: 'survey' | 'document' | 'kvp',
    userId: number,
    tenantId: number,
  ): Promise<number> {
    this.logger.log(`Marking all ${type} notifications as read for user ${userId}`);

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

  // ==========================================================================
  // PUSH NOTIFICATIONS (PLACEHOLDERS)
  // ==========================================================================

  /**
   * Subscribe to push notifications
   * Note: This is a placeholder - actual implementation pending
   */
  subscribe(
    _userId: number,
    _tenantId: number,
    _deviceToken: string,
    _platform: string,
  ): { subscriptionId: string } {
    this.logger.log('Push notification subscription (placeholder)');

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return { subscriptionId };
  }

  /**
   * Unsubscribe from push notifications
   * Note: This is a placeholder - actual implementation pending
   */
  unsubscribe(_userId: number, _tenantId: number, _subscriptionId: string): void {
    this.logger.log('Push notification unsubscription (placeholder)');
  }

  /**
   * Get notification templates (admin only)
   * Note: This is a placeholder - actual implementation pending
   */
  getTemplates(_tenantId: number): { templates: unknown[] } {
    this.logger.log('Get templates (placeholder)');
    return { templates: [] };
  }

  /**
   * Create notification from template (admin only)
   * Note: This is a placeholder - throws not found
   */
  createFromTemplate(
    _templateId: string,
    _tenantId: number,
    _userId: number,
    _recipientType: string,
    _recipientId?: number,
    _variables?: Record<string, unknown>,
  ): never {
    this.logger.log('Create from template (not implemented)');
    throw new NotFoundException('Template not found');
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Build query conditions for notification listing
   */
  private buildNotificationConditions(
    userId: number,
    tenantId: number,
    filters: NotificationFilters,
  ): { conditions: string[]; params: (string | number | boolean)[] } {
    const conditions = [`n.tenant_id = $1`];
    const params: (string | number | boolean)[] = [tenantId];

    // Complex recipient condition
    conditions.push(`(n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = $2)
      OR (n.recipient_type = 'department' AND n.recipient_id IN (
        SELECT ud.department_id FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        WHERE u.id = $3 AND u.tenant_id = $4))
      OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = $5 AND tenant_id = $6)))`);
    params.push(userId, userId, tenantId, userId, tenantId);

    if (filters.type !== undefined && filters.type !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`n.type = $${paramIndex}`);
      params.push(filters.type);
    }

    if (filters.priority !== undefined && filters.priority !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`n.priority = $${paramIndex}`);
      params.push(filters.priority);
    }

    return { conditions, params };
  }

  /**
   * Get notification counts (total and unread)
   */
  private async getNotificationCounts(
    userId: number,
    conditions: string[],
    params: (string | number | boolean)[],
    filters: NotificationFilters,
  ): Promise<{ total: number; unreadCount: number }> {
    // userId needs to be at the correct parameter index after existing params
    const userIdParamIndex = params.length + 1;

    // Total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications n
      LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $${userIdParamIndex}
      WHERE ${conditions.join(' AND ')}
      ${filters.unread === true ? 'AND nrs.id IS NULL' : ''}
    `;
    const countRows = await this.db.query<DbCountRow>(countQuery, [...params, userId]);
    const total = countRows[0]?.total ?? 0;

    // Unread count
    const unreadQuery = `
      SELECT COUNT(*) as unread_count
      FROM notifications n
      LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $${userIdParamIndex}
      WHERE ${conditions.join(' AND ')} AND nrs.id IS NULL
    `;
    const unreadRows = await this.db.query<DbCountRow>(unreadQuery, [...params, userId]);
    const unreadCount = unreadRows[0]?.unread_count ?? 0;

    return { total, unreadCount };
  }

  /**
   * Map database row to API response
   */
  private mapNotificationToApi(row: DbNotificationRow): NotificationResponse {
    let metadata: Record<string, unknown> | null = null;
    if (row.metadata !== null) {
      try {
        metadata =
          typeof row.metadata === 'string' ?
            (JSON.parse(row.metadata) as Record<string, unknown>)
          : (row.metadata as unknown as Record<string, unknown>);
      } catch {
        metadata = null;
      }
    }

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      recipientType: row.recipient_type,
      recipientId: row.recipient_id,
      actionUrl: row.action_url,
      actionLabel: row.action_label,
      metadata,
      scheduledFor: row.scheduled_for,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      tenantId: row.tenant_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      readAt: row.read_at !== null && row.read_at !== undefined ? row.read_at.toISOString() : null,
      isRead: row.is_read ?? false,
    };
  }

  /**
   * Get default notification preferences
   */
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

  /**
   * Convert database rows to record map
   */
  private rowsToRecord<T extends { count: number }>(
    rows: T[],
    keyFn: (row: T) => string,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[keyFn(row)] = row.count;
    }
    return result;
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    userId: number,
    tenantId: number,
    entityType: string,
    entityId: number,
    newValues: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO root_logs (action, user_id, tenant_id, entity_type, entity_id, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          action,
          userId,
          tenantId,
          entityType,
          entityId,
          JSON.stringify(newValues),
          ipAddress ?? null,
          userAgent ?? null,
        ],
      );
    } catch (error: unknown) {
      this.logger.error('Failed to create audit log:', error);
    }
  }

  // ============================================================
  // UUID-BASED METHODS (P1 Migration)
  // ============================================================

  /**
   * Resolve notification UUID to internal ID
   */
  private async resolveNotificationIdByUuid(uuid: string, tenantId: number): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(`Notification with UUID ${uuid} not found`);
    }
    return result[0].id;
  }

  /**
   * Mark notification as read by UUID
   */
  async markAsReadByUuid(uuid: string, userId: number, tenantId: number): Promise<void> {
    const notificationId = await this.resolveNotificationIdByUuid(uuid, tenantId);
    await this.markAsRead(notificationId, userId, tenantId);
  }

  /**
   * Delete notification by UUID
   */
  async deleteNotificationByUuid(
    uuid: string,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const notificationId = await this.resolveNotificationIdByUuid(uuid, tenantId);
    await this.deleteNotification(notificationId, userId, tenantId, userRole, ipAddress, userAgent);
  }
}
