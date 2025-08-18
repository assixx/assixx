/**
 * Notifications v2 Service
 * Business logic for notification management
 */

import { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  NotificationFilters,
  NotificationData,
  NotificationPreferences,
} from "./types.js";
import { executeQuery } from "../../../database.js";
import RootLog from "../../../models/rootLog";
import { dbToApi } from "../../../utils/fieldMapping.js";
import { ServiceError } from "../../../utils/ServiceError.js";

/**
 * Get notifications for a user with filters
 * @param userId
 * @param tenantId
 * @param filters
 */
export async function listNotifications(
  userId: number,
  tenantId: number,
  filters: NotificationFilters,
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  // Build query conditions
  const conditions = [`n.tenant_id = ?`];
  const params: (string | number | boolean)[] = [tenantId];

  // User can see broadcast notifications or their own
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

  // Build the main query
  let query = `
    SELECT 
      n.*,
      nrs.read_at,
      CASE WHEN nrs.id IS NOT NULL THEN true ELSE false END as is_read,
      u.username as created_by_name
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    LEFT JOIN users u ON n.created_by = u.id
    WHERE ${String(conditions.join(" AND "))}
  `;

  // Add unread filter if specified
  if (filters.unread === true) {
    query += ` AND nrs.id IS NULL`;
  }

  // Add ordering and pagination
  query += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
  params.unshift(userId); // For the JOIN
  params.push(limit, offset);

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    WHERE ${String(conditions.join(" AND "))}
    ${filters.unread === true ? "AND nrs.id IS NULL" : ""}
  `;
  const countParams = [userId, ...params.slice(1, -2)]; // Exclude limit/offset
  const [[countResult]] = await executeQuery<RowDataPacket[]>(
    countQuery,
    countParams,
  );
  const total = countResult.total;

  // Get unread count
  const unreadQuery = `
    SELECT COUNT(*) as unread
    FROM notifications n
    LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
    WHERE ${String(conditions.join(" AND "))} AND nrs.id IS NULL
  `;
  const [[unreadResult]] = await executeQuery<RowDataPacket[]>(unreadQuery, [
    userId,
    ...params.slice(1, -2),
  ]);
  const unreadCount = unreadResult.unread;

  return {
    notifications: rows.map((row) => dbToApi(row)),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create a new notification
 * @param data
 * @param createdBy
 * @param tenantId
 * @param ipAddress
 * @param userAgent
 */
export async function createNotification(
  data: NotificationData,
  createdBy: number,
  tenantId: number,
  ipAddress?: string,
  userAgent?: string,
) {
  const [result] = await executeQuery<ResultSetHeader>(
    `INSERT INTO notifications 
    (type, title, message, priority, recipient_id, recipient_type, action_url, action_label, 
     metadata, scheduled_for, created_by, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.type,
      data.title,
      data.message,
      data.priority ?? "normal",
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
  await RootLog.create({
    tenant_id: tenantId,
    user_id: createdBy,
    action: "notification_created",
    entity_type: "notification",
    entity_id: result.insertId,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { notificationId: result.insertId };
}

/**
 * Mark notification as read
 * @param notificationId
 * @param userId
 * @param tenantId
 */
export async function markAsRead(
  notificationId: number,
  userId: number,
  tenantId: number,
) {
  // Check if notification exists and user has access
  const [[notification]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM notifications 
     WHERE id = ? AND tenant_id = ? 
     AND (recipient_type = 'all' OR (recipient_type = 'user' AND recipient_id = ?)
          OR (recipient_type = 'department' AND recipient_id IN (SELECT department_id FROM users WHERE id = ?))
          OR (recipient_type = 'team' AND recipient_id IN (SELECT team_id FROM user_teams WHERE user_id = ?)))`,
    [notificationId, tenantId, userId, userId, userId],
  );

  if (!notification) {
    throw new ServiceError("NOT_FOUND", "Notification not found", 404);
  }

  // Check if already read
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM notification_read_status WHERE notification_id = ? AND user_id = ?`,
    [notificationId, userId],
  );

  if (!existing) {
    // Mark as read
    await executeQuery(
      `INSERT INTO notification_read_status (notification_id, user_id, tenant_id) VALUES (?, ?, ?)`,
      [notificationId, userId, tenantId],
    );
  }

  return { success: true };
}

/**
 * Mark all notifications as read
 * @param userId
 * @param tenantId
 */
export async function markAllAsRead(userId: number, tenantId: number) {
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

  return { markedCount };
}

/**
 * Delete notification
 * @param notificationId
 * @param userId
 * @param tenantId
 * @param userRole
 * @param ipAddress
 * @param userAgent
 */
export async function deleteNotification(
  notificationId: number,
  userId: number,
  tenantId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  // Check if notification exists
  const [[notification]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM notifications WHERE id = ? AND tenant_id = ?`,
    [notificationId, tenantId],
  );

  if (!notification) {
    throw new ServiceError("NOT_FOUND", "Notification not found", 404);
  }

  // Check permissions - admin can delete any, users only their own
  if (userRole !== "admin" && userRole !== "root") {
    if (
      notification.recipient_type !== "user" ||
      notification.recipient_id !== userId
    ) {
      throw new ServiceError("NOT_FOUND", "Notification not found", 404);
    }
  }

  // Delete notification
  await executeQuery(`DELETE FROM notifications WHERE id = ?`, [
    notificationId,
  ]);

  // Log the action
  await RootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: "notification_deleted",
    entity_type: "notification",
    entity_id: notificationId,
    old_values: notification,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Get notification preferences
 * @param userId
 * @param tenantId
 */
export async function getPreferences(userId: number, tenantId: number) {
  try {
    const [[prefs]] = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM notification_preferences WHERE user_id = ? AND tenant_id = ? AND notification_type = 'general'`,
      [userId, tenantId],
    );

    if (!prefs) {
      // Return default preferences
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

    let notificationTypes = {};
    if (prefs.preferences) {
      try {
        notificationTypes =
          typeof prefs.preferences === "string"
            ? JSON.parse(prefs.preferences)
            : prefs.preferences;
      } catch (error: unknown) {
        console.error(
          "[Notifications Service] Failed to parse preferences:",
          error,
        );
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
    console.error("[Notifications Service] getPreferences error:", error);
    throw error;
  }
}

/**
 * Update notification preferences
 * @param userId
 * @param tenantId
 * @param preferences
 * @param ipAddress
 * @param userAgent
 */
export async function updatePreferences(
  userId: number,
  tenantId: number,
  preferences: NotificationPreferences,
  ipAddress?: string,
  userAgent?: string,
) {
  // Check if preferences exist
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM notification_preferences WHERE user_id = ? AND tenant_id = ? AND notification_type = 'general'`,
    [userId, tenantId],
  );

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
  await RootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: "notification_preferences_updated",
    entity_type: "user",
    entity_id: userId,
    new_values: preferences as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Get notification statistics (admin only)
 * @param tenantId
 */
export async function getStatistics(tenantId: number) {
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
    readRateResult.total_notifications > 0
      ? readRateResult.read_notifications / readRateResult.total_notifications
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
    byType[row.type] = row.count;
  });

  const byPriority: Record<string, number> = {};
  byPriorityRows.forEach((row) => {
    byPriority[row.priority] = row.count;
  });

  return {
    total: totalResult.total,
    byType,
    byPriority,
    readRate,
    trends: trendsRows.map((row) => ({
      date: row.date,
      count: row.count,
    })),
  };
}

/**
 * Get personal notification statistics
 * @param userId
 * @param tenantId
 */
export async function getPersonalStats(userId: number, tenantId: number) {
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
    byType[row.type] = row.count;
  });

  return {
    total: totalResult.total,
    unread: unreadResult.unread,
    byType,
  };
}
