/**
 * Send Message DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_MESSAGE_LENGTH = 5000;

export const SendMessageBodySchema = z.object({
  message: z
    .string()
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .optional(),
});

export class SendMessageDto extends createZodDto(SendMessageBodySchema) {}

// Type export
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
