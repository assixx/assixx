/**
 * Notifications v2 Service
 * Business logic for notification management
 */
import { ResultSetHeader, RowDataPacket } from 'mysql2';

import rootLog from '../../../models/rootLog';
import { ServiceError } from '../../../utils/ServiceError.js';
import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { NotificationData, NotificationFilters, NotificationPreferences } from './types.js';

/**
 * Build query conditions for notifications
 */
function buildNotificationConditions(
  userId: number,
  tenantId: number,
  filters: NotificationFilters,
): { conditions: string[]; params: (string | number | boolean)[] } {
  const conditions = [`n.tenant_id = ?`];
  const params: (string | number | boolean)[] = [tenantId];

  conditions.push(`(n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = ?)
    OR (n.recipient_type = 'department' AND n.recipient_id IN (SELECT department_id FROM users WHERE id = ?))
    OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))`);
  params.push(userId, userId, userId);

  if (filters.type) {
    conditions.push(`n.type = ?`);
    params.push(filters.type);
  }

  if (filters.priority) {
    conditions.push(`n.priority = ?`);
    params.push(filters.priority);
  }

  return { conditions, params };
}

/**
 * Get counts for notifications
 */
async function getNotificationCounts(
  userId: number,
  conditions: string[],
  params: (string | number | boolean)[],
  filters: NotificationFilters,
): Promise<{ total: number; unreadCount: number }> {
  const countQuery = `
    SELECT COUNT(*) as total
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    WHERE ${conditions.join(' AND ')}
    ${filters.unread === true ? 'AND nrs.id IS NULL' : ''}
  `;
  const [[countResult]] = await executeQuery<RowDataPacket[]>(countQuery, [userId, ...params]);

  const unreadQuery = `
    SELECT COUNT(*) as unread
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    WHERE ${conditions.join(' AND ')} AND nrs.id IS NULL
  `;
  const [[unreadResult]] = await executeQuery<RowDataPacket[]>(unreadQuery, [userId, ...params]);

  return { total: Number(countResult.total), unreadCount: Number(unreadResult.unread) };
}

/**
 * Get notifications for a user with filters
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param filters - The filter criteria
 */
export async function listNotifications(
  userId: number,
  tenantId: number,
  filters: NotificationFilters,
): Promise<{
  notifications: unknown[];
  total: number;
  page: number;
  totalPages: number;
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const { conditions, params } = buildNotificationConditions(userId, tenantId, filters);

  // Build and execute main query
  let query = `
    SELECT n.*, nrs.read_at,
      CASE WHEN nrs.id IS NOT NULL THEN true ELSE false END as is_read,
      u.username as created_by_name
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    LEFT JOIN users u ON n.created_by = u.id
    WHERE ${conditions.join(' AND ')}
    ${filters.unread === true ? 'AND nrs.id IS NULL' : ''}
    ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;

  const [rows] = await executeQuery<RowDataPacket[]>(query, [userId, ...params, limit, offset]);

  const { total, unreadCount } = await getNotificationCounts(userId, conditions, params, filters);
  const totalPages = Math.ceil(total / limit);

  return {
    notifications: rows.map((row) => dbToApi(row)),
    total,
    page,
    totalPages,
    unreadCount,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Create a new notification
 * @param data - The data object
 * @param createdBy - The createdBy parameter
 * @param tenantId - The tenant ID
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function createNotification(
  data: NotificationData,
  createdBy: number,
  tenantId: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ notificationId: number }> {
  const [result] = await executeQuery<ResultSetHeader>(
    `INSERT INTO notifications
    (type, title, message, priority, recipient_id, recipient_type, action_url, action_label,
     metadata, scheduled_for, created_by, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.type,
      data.title,
      data.message,
      data.priority ?? 'normal',
      data.recipient_id ?? null,
      data.recipient_type,
      data.action_url ?? null,
      data.action_label ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.scheduled_for ?? null,
      createdBy,
      tenantId,
    ],
  );

  // Log the action
  await rootLog.create({
    tenant_id: tenantId,
    user_id: createdBy,
    action: 'notification_created',
    entity_type: 'notification',
    entity_id: result.insertId,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { notificationId: result.insertId };
}

/**
 * Mark notification as read
 * @param notificationId - The notificationId parameter
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
export async function markAsRead(
  notificationId: number,
  userId: number,
  tenantId: number,
): Promise<void> {
  // Check if notification exists and user has access
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM notifications
     WHERE id = ? AND tenant_id = ?
     AND (recipient_type = 'all' OR (recipient_type = 'user' AND recipient_id = ?)
          OR (recipient_type = 'department' AND recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (recipient_type = 'team' AND recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))`,
    [notificationId, tenantId, userId, userId, userId],
  );
  const notification = rows[0] as RowDataPacket | undefined;

  if (!notification) {
    throw new ServiceError('NOT_FOUND', 'Notification not found', 404);
  }

  // Check if already read
  // Mark as read if not already
  await executeQuery(
    `INSERT IGNORE INTO notification_read_status (notification_id, user_id, tenant_id) VALUES (?, ?, ?)`,
    [notificationId, userId, tenantId],
  );
}

/**
 * Mark all notifications as read
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
export async function markAllAsRead(
  userId: number,
  tenantId: number,
): Promise<{ updated: number }> {
  // Get all unread notifications for user
  const [unreadNotifications] = await executeQuery<RowDataPacket[]>(
    `SELECT n.id FROM notifications n
     LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
     WHERE n.tenant_id = ?
     AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = ?)
          OR (n.recipient_type = 'department' AND n.recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))
     AND nrs.id IS NULL`,
    [userId, tenantId, userId, userId, userId],
  );

  let markedCount = 0;
  for (const notification of unreadNotifications) {
    await executeQuery(
      `INSERT IGNORE INTO notification_read_status (notification_id, user_id, tenant_id) VALUES (?, ?, ?)`,
      [notification.id, userId, tenantId],
    );
    markedCount++;
  }

  return { updated: markedCount };
}

/**
 * Delete notification
 * @param notificationId - The notificationId parameter
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function deleteNotification(
  notificationId: number,
  userId: number,
  tenantId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  // Check if notification exists
  const [rows2] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM notifications WHERE id = ? AND tenant_id = ?`,
    [notificationId, tenantId],
  );
  const notification = rows2[0] as RowDataPacket | undefined;

  if (!notification) {
    throw new ServiceError('NOT_FOUND', 'Notification not found', 404);
  }

  // Check permissions - admin can delete any, users only their own
  if (
    userRole !== 'admin' &&
    userRole !== 'root' &&
    (notification.recipient_type !== 'user' || notification.recipient_id !== userId)
  ) {
    throw new ServiceError('NOT_FOUND', 'Notification not found', 404);
  }

  // Delete notification
  await executeQuery(`DELETE FROM notifications WHERE id = ?`, [notificationId]);

  // Log the action
  await rootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: 'notification_deleted',
    entity_type: 'notification',
    entity_id: notificationId,
    old_values: notification,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

/**
 * Get notification preferences
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
export async function getPreferences(userId: number, tenantId: number): Promise<unknown> {
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM notification_preferences WHERE user_id = ? AND tenant_id = ? AND notification_type = 'general'`,
      [userId, tenantId],
    );
    const prefs = rows[0] as RowDataPacket | undefined;

    if (!prefs) {
      // Return default preferences if none exist
      return {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        notification_types: {
          system: { email: true, push: true, sms: false },
          task: { email: true, push: true, sms: false },
          message: { email: false, push: true, sms: false },
          announcement: { email: true, push: true, sms: false },
        },
      };
    }

    let notificationTypes: Record<string, unknown> = {};
    if (prefs.preferences) {
      try {
        notificationTypes =
          typeof prefs.preferences === 'string' ?
            (JSON.parse(prefs.preferences) as Record<string, unknown>)
          : (prefs.preferences as Record<string, unknown>);
      } catch (error: unknown) {
        console.error('[Notifications Service] Failed to parse preferences:', error);
        notificationTypes = {};
      }
    }

    return {
      email_notifications: !!prefs.email_notifications,
      push_notifications: !!prefs.push_notifications,
      sms_notifications: !!prefs.sms_notifications,
      notification_types: notificationTypes,
    };
  } catch (error: unknown) {
    console.error('[Notifications Service] getPreferences error:', error);
    throw error;
  }
}

/**
 * Update notification preferences
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param preferences - The preferences parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function updatePreferences(
  userId: number,
  tenantId: number,
  preferences: NotificationPreferences,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  // Check if preferences exist
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM notification_preferences WHERE user_id = ? AND tenant_id = ? AND notification_type = 'general'`,
    [userId, tenantId],
  );
  const existing = rows[0] as RowDataPacket | undefined;

  if (existing) {
    // Update existing
    await executeQuery(
      `UPDATE notification_preferences
       SET email_notifications = ?, push_notifications = ?, sms_notifications = ?,
           preferences = ?, updated_at = NOW()
       WHERE user_id = ? AND tenant_id = ? AND notification_type = 'general'`,
      [
        preferences.email_notifications,
        preferences.push_notifications,
        preferences.sms_notifications,
        JSON.stringify(preferences.notification_types ?? {}),
        userId,
        tenantId,
      ],
    );
  } else {
    // Insert new
    await executeQuery(
      `INSERT INTO notification_preferences
       (user_id, tenant_id, email_notifications, push_notifications, sms_notifications, preferences, notification_type)
       VALUES (?, ?, ?, ?, ?, ?, 'general')`,
      [
        userId,
        tenantId,
        preferences.email_notifications,
        preferences.push_notifications,
        preferences.sms_notifications,
        JSON.stringify(preferences.notification_types ?? {}),
      ],
    );
  }

  // Log the action
  await rootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: 'notification_preferences_updated',
    entity_type: 'user',
    entity_id: userId,
    new_values: preferences as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

/**
 * Get notification statistics (admin only)
 * @param tenantId - The tenant ID
 */
export async function getStatistics(tenantId: number): Promise<unknown> {
  // Total notifications
  const [[totalResult]] = await executeQuery<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM notifications WHERE tenant_id = ?`,
    [tenantId],
  );

  // By type
  const [byTypeRows] = await executeQuery<RowDataPacket[]>(
    `SELECT type, COUNT(*) as count FROM notifications WHERE tenant_id = ? GROUP BY type`,
    [tenantId],
  );

  // By priority
  const [byPriorityRows] = await executeQuery<RowDataPacket[]>(
    `SELECT priority, COUNT(*) as count FROM notifications WHERE tenant_id = ? GROUP BY priority`,
    [tenantId],
  );

  // Read rate
  const [[readRateResult]] = await executeQuery<RowDataPacket[]>(
    `SELECT
      COUNT(DISTINCT n.id) as total_notifications,
      COUNT(DISTINCT nrs.notification_id) as read_notifications
     FROM notifications n
     LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id
     WHERE n.tenant_id = ?`,
    [tenantId],
  );

  const readRate =
    readRateResult.total_notifications > 0 ?
      readRateResult.read_notifications / readRateResult.total_notifications
    : 0;

  // Trends (last 30 days)
  const [trendsRows] = await executeQuery<RowDataPacket[]>(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as count
     FROM notifications
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [tenantId],
  );

  const byType: Record<string, number> = {};
  byTypeRows.forEach((row) => {
    byType[String(row.type)] = Number(row.count);
  });

  const byPriority: Record<string, number> = {};
  byPriorityRows.forEach((row) => {
    byPriority[String(row.priority)] = Number(row.count);
  });

  return {
    total: Number(totalResult.total),
    byType,
    byPriority,
    readRate,
    trends: trendsRows.map((row) => ({
      date: String(row.date),
      count: Number(row.count),
    })),
  };
}

/**
 * Get personal notification statistics
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
export async function getPersonalStats(userId: number, tenantId: number): Promise<unknown> {
  // Total notifications for user
  const [[totalResult]] = await executeQuery<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM notifications n
     WHERE n.tenant_id = ?
     AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = ?)
          OR (n.recipient_type = 'department' AND n.recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))`,
    [tenantId, userId, userId, userId],
  );

  // Unread count
  const [[unreadResult]] = await executeQuery<RowDataPacket[]>(
    `SELECT COUNT(*) as unread FROM notifications n
     LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
     WHERE n.tenant_id = ?
     AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = ?)
          OR (n.recipient_type = 'department' AND n.recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))
     AND nrs.id IS NULL`,
    [userId, tenantId, userId, userId, userId],
  );

  // By type
  const [byTypeRows] = await executeQuery<RowDataPacket[]>(
    `SELECT n.type, COUNT(*) as count FROM notifications n
     WHERE n.tenant_id = ?
     AND (n.recipient_type = 'all' OR (n.recipient_type = 'user' AND n.recipient_id = ?)
          OR (n.recipient_type = 'department' AND n.recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (n.recipient_type = 'team' AND n.recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))
     GROUP BY n.type`,
    [tenantId, userId, userId, userId],
  );

  const byType: Record<string, number> = {};
  byTypeRows.forEach((row) => {
    byType[String(row.type)] = Number(row.count);
  });

  return {
    total: Number(totalResult.total),
    unread: Number(unreadResult.unread),
    byType,
  };
}
