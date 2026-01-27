/**
 * Message ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MessageIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int('Message ID must be an integer')
    .min(1, 'Invalid message ID'),
});

export class MessageIdParamDto extends createZodDto(MessageIdParamSchema) {}

// Type export
export type MessageIdParam = z.infer<typeof MessageIdParamSchema>;
