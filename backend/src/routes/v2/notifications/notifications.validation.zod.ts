/**
 * Notifications API v2 Validation with Zod
 * Replaces express-validator with Zod for notification endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Notification type enum
 */
const NotificationTypeSchema = z.enum(['system', 'task', 'message', 'announcement', 'reminder'], {
  message: 'Invalid notification type',
});

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'medium', 'high', 'urgent'], {
  message: 'Invalid priority',
});

/**
 * Recipient type enum
 */
const RecipientTypeSchema = z.enum(['user', 'department', 'team', 'all'], {
  message: 'Invalid recipient type',
});

/**
 * Platform enum for subscriptions
 */
const PlatformSchema = z.enum(['web', 'ios', 'android'], {
  message: 'Invalid platform',
});

/**
 * Notification preferences validation
 * Validates notification types structure
 */
const NotificationTypesSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List notifications query parameters
 */
export const ListNotificationsQuerySchema = PaginationSchema.extend({
  type: NotificationTypeSchema.optional(),
  priority: PrioritySchema.optional(),
  unread: z.preprocess(
    (val) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Notification ID parameter validation
 */
export const NotificationIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Subscription ID parameter validation
 */
export const SubscriptionIdParamSchema = z.object({
  id: z.string().min(1, 'Subscription ID is required'),
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create notification request body
 */
export const CreateNotificationBodySchema = z
  .object({
    type: NotificationTypeSchema,
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title must not exceed 255 characters'),
    message: z.string().trim().min(1, 'Message is required'),
    priority: PrioritySchema.optional(),
    recipient_type: RecipientTypeSchema,
    recipient_id: IdSchema.optional(),
    action_url: z.string().max(500, 'Action URL cannot exceed 500 characters').optional(),
    action_label: z.string().max(100, 'Action label cannot exceed 100 characters').optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    scheduled_for: DateSchema.optional(),
  })
  .refine(
    (data) => {
      return data.recipient_type === 'all' || Boolean(data.recipient_id);
    },
    {
      message: 'Recipient ID is required for this recipient type',
      path: ['recipient_id'],
    },
  );

/**
 * Update preferences request body
 */
export const UpdatePreferencesBodySchema = z.object({
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  notification_types: NotificationTypesSchema.optional(),
});

/**
 * Subscribe request body
 */
export const SubscribeBodySchema = z.object({
  deviceToken: z.string().trim().min(1, 'Device token is required'),
  platform: PlatformSchema,
});

/**
 * Create from template request body
 */
export const CreateFromTemplateBodySchema = z.object({
  templateId: z.string().trim().min(1, 'Template ID is required'),
  variables: z.record(z.string(), z.unknown()).optional(),
  recipient_type: RecipientTypeSchema,
  recipient_id: IdSchema.optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
export type NotificationIdParam = z.infer<typeof NotificationIdParamSchema>;
export type SubscriptionIdParam = z.infer<typeof SubscriptionIdParamSchema>;
export type CreateNotificationBody = z.infer<typeof CreateNotificationBodySchema>;
export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesBodySchema>;
export type SubscribeBody = z.infer<typeof SubscribeBodySchema>;
export type CreateFromTemplateBody = z.infer<typeof CreateFromTemplateBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for notification routes
 */
export const notificationsValidationZod = {
  listNotifications: validateQuery(ListNotificationsQuerySchema),
  createNotification: validateBody(CreateNotificationBodySchema),
  markAsRead: validateParams(NotificationIdParamSchema),
  deleteNotification: validateParams(NotificationIdParamSchema),
  updatePreferences: validateBody(UpdatePreferencesBodySchema),
  subscribe: validateBody(SubscribeBodySchema),
  unsubscribe: validateParams(SubscriptionIdParamSchema),
  createFromTemplate: validateBody(CreateFromTemplateBodySchema),
};
