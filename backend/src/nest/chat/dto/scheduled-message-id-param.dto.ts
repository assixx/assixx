/**
 * Scheduled Message ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ScheduledMessageIdParamSchema = z.object({
  id: z.uuid({ message: 'Invalid UUID format' }),
});

export class ScheduledMessageIdParamDto extends createZodDto(ScheduledMessageIdParamSchema) {}

// Type export
export type ScheduledMessageIdParam = z.infer<typeof ScheduledMessageIdParamSchema>;
