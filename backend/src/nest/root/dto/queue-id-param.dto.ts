/**
 * Queue ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueueIdParamSchema = z.object({
  queueId: z.coerce.number().int().positive('Queue ID must be positive'),
});

export class QueueIdParamDto extends createZodDto(QueueIdParamSchema) {}
