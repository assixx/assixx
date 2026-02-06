/**
 * Conversation Messages Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConversationMessagesParamSchema = z.object({
  id: z.coerce
    .number()
    .int('Conversation ID must be an integer')
    .min(1, 'Invalid conversation ID'),
});

export class ConversationMessagesParamDto extends createZodDto(
  ConversationMessagesParamSchema,
) {}

// Type export
export type ConversationMessagesParam = z.infer<
  typeof ConversationMessagesParamSchema
>;
