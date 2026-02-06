/**
 * Notifications Service - Facade
 *
 * Orchestrates notification operations and delegates to sub-services:
 * - NotificationPreferencesService - user preference CRUD
 * - NotificationStatisticsService - analytics and stats
 * - NotificationFeatureService - feature-specific notifications (ADR-004)
 *
 * Pure helper functions are in notifications.helpers.ts
 * Types are in notifications.types.ts
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateNotificationDto } from './dto/create-notification.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { NotificationFeatureService } from './notification-feature.service.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';
import { NotificationStatisticsService } from './notification-statistics.service.js';
import {
  buildNotificationConditions,
  mapNotificationToApi,
} from './notifications.helpers.js';
import type {
  DbCountRow,
  DbIdRow,
  DbNotificationRow,
  NotificationFilters,
  NotificationPreferencesResponse,
  NotificationStatisticsResponse,
  PaginatedNotificationsResult,
  PersonalStatsResponse,
} from './notifications.types.js';
import { NOTIFICATION_ERROR_CODES } from './notifications.types.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly preferences: NotificationPreferencesService,
    private readonly statistics: NotificationStatisticsService,
    private readonly feature: NotificationFeatureService,
  ) {}

  // ==========================================================================
  // CORE CRUD
  // ==========================================================================

  /**
   * List notifications for a user with filters
   */
  async listNotifications(
    userId: number,
    tenantId: number,
    filters: NotificationFilters,
  ): Promise<PaginatedNotificationsResult> {
    this.logger.debug(
      `Listing notifications for user ${userId} in tenant ${tenantId}`,
    );

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const { conditions, params } = buildNotificationConditions(
      userId,
      tenantId,
      filters,
    );

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

    const rows = await this.db.query<DbNotificationRow>(query, [
      ...params,
      userId,
      limit,
      offset,
    ]);

    const { total, unreadCount } = await this.getNotificationCounts(
      userId,
      conditions,
      params,
      filters,
    );
    const totalPages = Math.ceil(total / limit);

    return {
      notifications: rows.map((row: DbNotificationRow) =>
        mapNotificationToApi(row),
      ),
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
  async markAsRead(
    notificationId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(
      `Marking notification ${notificationId} as read for user ${userId}`,
    );

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
        code: NOTIFICATION_ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

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
  async markAllAsRead(
    userId: number,
    tenantId: number,
  ): Promise<{ updated: number }> {
    this.logger.log(`Marking all notifications as read for user ${userId}`);

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

    const rows = await this.db.query<DbNotificationRow>(
      `SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2`,
      [notificationId, tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: NOTIFICATION_ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    const notification = rows[0];
    if (notification === undefined) {
      throw new NotFoundException({
        code: NOTIFICATION_ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    if (
      userRole !== 'admin' &&
      userRole !== 'root' &&
      (notification.recipient_type !== 'user' ||
        notification.recipient_id !== userId)
    ) {
      throw new NotFoundException({
        code: NOTIFICATION_ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    await this.db.query(
      `DELETE FROM notifications WHERE id = $1 AND tenant_id = $2`,
      [notificationId, tenantId],
    );

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
  // DELEGATED OPERATIONS
  // ==========================================================================

  /** Get notification preferences (delegates to preferences sub-service) */
  async getPreferences(
    userId: number,
    tenantId: number,
  ): Promise<NotificationPreferencesResponse> {
    return await this.preferences.getPreferences(userId, tenantId);
  }

  /**
   * Update notification preferences.
   * Orchestrates: preferences upsert + audit logging.
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

    await this.preferences.upsertPreferences(
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

  /** Get notification statistics (delegates to statistics sub-service) */
  async getStatistics(
    tenantId: number,
  ): Promise<NotificationStatisticsResponse> {
    return await this.statistics.getStatistics(tenantId);
  }

  /** Get personal notification statistics (delegates to statistics sub-service) */
  async getPersonalStats(
    userId: number,
    tenantId: number,
  ): Promise<PersonalStatsResponse> {
    return await this.statistics.getPersonalStats(userId, tenantId);
  }

  /** Create feature notification (delegates to feature sub-service) */
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
    await this.feature.createFeatureNotification(
      type,
      featureId,
      title,
      message,
      recipientType,
      recipientId,
      tenantId,
      createdBy,
    );
  }

  /** Mark feature type as read (delegates to feature sub-service) */
  async markFeatureTypeAsRead(
    type: 'survey' | 'document' | 'kvp',
    userId: number,
    tenantId: number,
  ): Promise<number> {
    return await this.feature.markFeatureTypeAsRead(type, userId, tenantId);
  }

  // ==========================================================================
  // UUID-BASED METHODS (P1 Migration)
  // ==========================================================================

  /** Mark notification as read by UUID */
  async markAsReadByUuid(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const notificationId = await this.resolveNotificationIdByUuid(
      uuid,
      tenantId,
    );
    await this.markAsRead(notificationId, userId, tenantId);
  }

  /** Delete notification by UUID */
  async deleteNotificationByUuid(
    uuid: string,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const notificationId = await this.resolveNotificationIdByUuid(
      uuid,
      tenantId,
    );
    await this.deleteNotification(
      notificationId,
      userId,
      tenantId,
      userRole,
      ipAddress,
      userAgent,
    );
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /** Resolve notification UUID to internal ID */
  private async resolveNotificationIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(`Notification with UUID ${uuid} not found`);
    }
    return result[0].id;
  }

  /** Get notification counts (total and unread) for listNotifications */
  private async getNotificationCounts(
    userId: number,
    conditions: string[],
    params: (string | number | boolean)[],
    filters: NotificationFilters,
  ): Promise<{ total: number; unreadCount: number }> {
    const userIdParamIndex = params.length + 1;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications n
      LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $${userIdParamIndex}
      WHERE ${conditions.join(' AND ')}
      ${filters.unread === true ? 'AND nrs.id IS NULL' : ''}
    `;
    const countRows = await this.db.query<DbCountRow>(countQuery, [
      ...params,
      userId,
    ]);
    const total = Number.parseInt(countRows[0]?.total ?? '0', 10);

    const unreadQuery = `
      SELECT COUNT(*) as unread_count
      FROM notifications n
      LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $${userIdParamIndex}
      WHERE ${conditions.join(' AND ')} AND nrs.id IS NULL
    `;
    const unreadRows = await this.db.query<DbCountRow>(unreadQuery, [
      ...params,
      userId,
    ]);
    const unreadCount = Number.parseInt(unreadRows[0]?.unread_count ?? '0', 10);

    return { total, unreadCount };
  }

  /** Create audit log entry */
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
}
