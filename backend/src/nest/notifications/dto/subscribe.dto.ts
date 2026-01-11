/**
 * Subscribe DTO
 *
 * Validation schema for push notification subscription.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Platform enum for subscriptions
 */
const PlatformSchema = z.enum(['web', 'ios', 'android'], {
  message: 'Invalid platform',
});

/**
 * Subscribe request body schema
 */
export const SubscribeSchema = z.object({
  deviceToken: z.string().trim().min(1, 'Device token is required'),
  platform: PlatformSchema,
});

/**
 * Subscribe DTO class
 */
export class SubscribeDto extends createZodDto(SubscribeSchema) {}
