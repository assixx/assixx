/**
 * Create Conversation DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_CONVERSATION_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 5000;

export const CreateConversationBodySchema = z.object({
  participantIds: z
    .array(z.number().int().min(1, 'Invalid participant ID'))
    .min(1, 'At least one participant is required'),
  name: z
    .string()
    .min(1)
    .max(
      MAX_CONVERSATION_NAME_LENGTH,
      `Name must be at most ${MAX_CONVERSATION_NAME_LENGTH} characters`,
    )
    .optional(),
  isGroup: z.boolean().optional(),
  initialMessage: z
    .string()
    .min(1, 'Initial message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .optional(),
});

export class CreateConversationDto extends createZodDto(CreateConversationBodySchema) {}

// Type export
export type CreateConversationBody = z.infer<typeof CreateConversationBodySchema>;
