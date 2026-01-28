/**
 * Conversation Attachments Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConversationAttachmentsParamSchema = z.object({
  id: z.coerce.number().int().min(1, 'Invalid conversation ID'),
});

export class ConversationAttachmentsParamDto extends createZodDto(
  ConversationAttachmentsParamSchema,
) {}

// Type export
export type ConversationAttachmentsParam = z.infer<
  typeof ConversationAttachmentsParamSchema
>;
