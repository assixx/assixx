/**
 * List Notifications Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Notification type enum for filtering
 */
const NotificationTypeSchema = z.enum(['system', 'task', 'message', 'announcement', 'reminder'], {
  message: 'Invalid notification type',
});

/**
 * Priority enum for filtering
 */
const PrioritySchema = z.enum(['low', 'normal', 'medium', 'high', 'urgent'], {
  message: 'Invalid priority',
});

/**
 * List notifications query parameters
 */
export const ListNotificationsQuerySchema = PaginationSchema.extend({
  type: NotificationTypeSchema.optional(),
  priority: PrioritySchema.optional(),
  unread: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

/**
 * List Notifications Query DTO class
 */
export class ListNotificationsQueryDto extends createZodDto(ListNotificationsQuerySchema) {}
