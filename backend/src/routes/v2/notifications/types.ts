/**
 * Type definitions for Notifications v2 API
 */

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  priority?: string;
  recipient_type: string;
  recipient_id?: number;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, unknown>;
  scheduled_for?: string;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  notification_types?: Record<
    string,
    { email: boolean; push: boolean; sms: boolean }
  >;
}

export interface NotificationFilters {
  type?: string;
  priority?: string;
  unread?: boolean;
  page?: number;
  limit?: number;
}
