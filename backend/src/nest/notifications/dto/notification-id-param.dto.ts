/**
 * Notification ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Notification ID parameter validation
 */
export const NotificationIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Notification ID Param DTO class
 */
export class NotificationIdParamDto extends createZodDto(
  NotificationIdParamSchema,
) {}
