/**
 * Notification Helpers - Pure functions (no DI, no DB calls)
 *
 * Mappers, query builders, and transforms for the notifications module.
 * Called by: notifications.service.ts (facade), notification-statistics.service.ts
 */
import type {
  DbNotificationRow,
  NotificationFilters,
  NotificationResponse,
} from './notifications.types.js';

// ============================================================================
// MAPPERS
// ============================================================================

/** Map database row to API response */
export function mapNotificationToApi(
  row: DbNotificationRow,
): NotificationResponse {
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
    readAt:
      row.read_at !== null && row.read_at !== undefined ?
        row.read_at.toISOString()
      : null,
    isRead: row.is_read ?? false,
  };
}

/**
 * Convert database rows to record map.
 * NOTE: PostgreSQL COUNT() returns bigint as string, so we parse it.
 */
export function rowsToRecord<T extends { count: string }>(
  rows: T[],
  keyFn: (row: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[keyFn(row)] = Number.parseInt(row.count, 10);
  }
  return result;
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/** Build query conditions for notification listing */
export function buildNotificationConditions(
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
