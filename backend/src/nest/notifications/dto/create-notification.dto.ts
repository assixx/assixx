/**
 * Create Notification DTO
 *
 * Validation schema for creating notifications (admin only).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema } from '../../../schemas/common.schema.js';

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
 * Create notification request body schema
 */
export const CreateNotificationSchema = z
  .object({
    type: NotificationTypeSchema,
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title must not exceed 255 characters'),
    message: z.string().trim().min(1, 'Message is required'),
    priority: PrioritySchema.optional(),
    recipientType: RecipientTypeSchema,
    recipientId: IdSchema.optional(),
    actionUrl: z.string().max(500, 'Action URL cannot exceed 500 characters').optional(),
    actionLabel: z.string().max(100, 'Action label cannot exceed 100 characters').optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    scheduledFor: DateSchema.optional(),
  })
  .refine(
    (data: { recipientType: string; recipientId?: number | undefined }): boolean => {
      return data.recipientType === 'all' || Boolean(data.recipientId);
    },
    {
      message: 'Recipient ID is required for this recipient type',
      path: ['recipientId'],
    },
  );

/**
 * Create Notification DTO class
 */
export class CreateNotificationDto extends createZodDto(CreateNotificationSchema) {}
