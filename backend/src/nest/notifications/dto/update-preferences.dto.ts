/**
 * Update Notification Preferences DTO
 *
 * Validation schema for updating notification preferences.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Notification types preferences structure
 */
const NotificationTypesSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

/**
 * Update preferences request body schema
 */
export const UpdatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  notificationTypes: NotificationTypesSchema.optional(),
});

/**
 * Update Preferences DTO class
 */
export class UpdatePreferencesDto extends createZodDto(UpdatePreferencesSchema) {}
