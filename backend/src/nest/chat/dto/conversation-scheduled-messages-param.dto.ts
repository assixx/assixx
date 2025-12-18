/**
 * Conversation Scheduled Messages Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConversationScheduledMessagesParamSchema = z.object({
  id: z.coerce.number().int().min(1, 'Invalid conversation ID'),
});

export class ConversationScheduledMessagesParamDto extends createZodDto(
  ConversationScheduledMessagesParamSchema,
) {}

// Type export
export type ConversationScheduledMessagesParam = z.infer<
  typeof ConversationScheduledMessagesParamSchema
>;
