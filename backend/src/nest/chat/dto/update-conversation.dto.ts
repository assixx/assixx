/**
 * Update Conversation DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_CONVERSATION_NAME_LENGTH = 100;

export const UpdateConversationBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(
      MAX_CONVERSATION_NAME_LENGTH,
      `Name must be at most ${MAX_CONVERSATION_NAME_LENGTH} characters`,
    )
    .optional(),
});

export class UpdateConversationDto extends createZodDto(
  UpdateConversationBodySchema,
) {}

// Type export
export type UpdateConversationBody = z.infer<
  typeof UpdateConversationBodySchema
>;
