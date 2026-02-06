/**
 * Edit Message DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_MESSAGE_LENGTH = 5000;

export const EditMessageBodySchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_MESSAGE_LENGTH,
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    ),
});

export class EditMessageDto extends createZodDto(EditMessageBodySchema) {}

// Type export
export type EditMessageBody = z.infer<typeof EditMessageBodySchema>;
