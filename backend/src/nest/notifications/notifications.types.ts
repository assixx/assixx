/**
 * Notification Types - Database and API interfaces
 *
 * Separated from service for cleaner code organization and ESLint max-lines compliance.
 * Shared by: notifications.service.ts (facade), sub-services, helpers, controller.
 */
import type { QueryResultRow } from 'pg';

// ============================================================================
// CONSTANTS
// ============================================================================

export const NOTIFICATION_ERROR_CODES = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
} as const;

// ============================================================================
// DATABASE ROW TYPES (internal - used by sub-services and helpers)
// ============================================================================

export interface DbNotificationRow extends QueryResultRow {
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

export interface DbNotificationPreferencesRow extends QueryResultRow {
  id: number;
  user_id: number;
  tenant_id: number;
  notification_type: string;
  email_notifications: number;
  push_notifications: number;
  sms_notifications: number;
  preferences: string | Record<string, unknown> | null;
}

export interface DbIdRow extends QueryResultRow {
  id: number;
}

// NOTE: PostgreSQL returns COUNT(*) as bigint, which pg driver converts to string
export interface DbCountRow extends QueryResultRow {
  total?: string;
  count?: string;
  unread_count?: string;
}

export interface DbTypeCountRow extends QueryResultRow {
  type: string;
  count: string; // PostgreSQL bigint -> string
}

export interface DbPriorityCountRow extends QueryResultRow {
  priority: string;
  count: string; // PostgreSQL bigint -> string
}

export interface DbReadRateRow extends QueryResultRow {
  total_notifications: string; // PostgreSQL bigint -> string
  read_notifications: string; // PostgreSQL bigint -> string
}

export interface DbDateCountRow extends QueryResultRow {
  date: string;
  count: string; // PostgreSQL bigint -> string
}

// ============================================================================
// API RESPONSE TYPES (exported for controller use)
// ============================================================================

/** Notification data for API response */
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

/** Paginated notifications result */
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

/** Notification preferences response */
export interface NotificationPreferencesResponse {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  notificationTypes: Record<string, { email: boolean; push: boolean; sms: boolean }>;
}

/** Notification statistics response */
export interface NotificationStatisticsResponse {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  readRate: number;
  trends: { date: string; count: number }[];
}

/** Personal stats response */
export interface PersonalStatsResponse {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

/** Notification filters for listing */
export interface NotificationFilters {
  type?: string | undefined;
  priority?: string | undefined;
  unread?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}
