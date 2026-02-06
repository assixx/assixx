/**
 * Conversation ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConversationIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int('Conversation ID must be an integer')
    .min(1, 'Invalid conversation ID'),
});

export class ConversationIdParamDto extends createZodDto(
  ConversationIdParamSchema,
) {}

// Type export
export type ConversationIdParam = z.infer<typeof ConversationIdParamSchema>;
