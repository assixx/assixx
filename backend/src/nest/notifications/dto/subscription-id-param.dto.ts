/**
 * Subscription ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Subscription ID parameter validation
 */
export const SubscriptionIdParamSchema = z.object({
  id: z.string().min(1, 'Subscription ID is required'),
});

/**
 * Subscription ID Param DTO class
 */
export class SubscriptionIdParamDto extends createZodDto(SubscriptionIdParamSchema) {}
