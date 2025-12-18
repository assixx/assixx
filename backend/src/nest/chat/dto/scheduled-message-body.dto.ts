/**
 * Scheduled Message Body DTOs
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Constants
const MAX_SCHEDULED_MESSAGE_LENGTH = 10000;
const MIN_SCHEDULE_MINUTES = 5;
const MAX_SCHEDULE_DAYS = 30;

export const CreateScheduledMessageBodySchema = z.object({
  conversationId: z
    .number()
    .int('conversationId must be an integer')
    .positive('conversationId must be positive'),

  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_SCHEDULED_MESSAGE_LENGTH,
      `Message is too long (max ${MAX_SCHEDULED_MESSAGE_LENGTH} characters)`,
    ),

  scheduledFor: z.iso
    .datetime({ message: 'Invalid date format (ISO 8601 expected)' })
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const minTime = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
        return scheduledDate > minTime;
      },
      { message: `Time must be at least ${MIN_SCHEDULE_MINUTES} minutes in the future` },
    )
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const maxTime = new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
        return scheduledDate <= maxTime;
      },
      { message: `Time must be at most ${MAX_SCHEDULE_DAYS} days in the future` },
    ),

  attachmentPath: z.string().max(500).optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentType: z.string().max(100).optional(),
  attachmentSize: z.number().int().nonnegative().optional(),
});

export class CreateScheduledMessageDto extends createZodDto(CreateScheduledMessageBodySchema) {}

// Type exports
export type CreateScheduledMessageBody = z.infer<typeof CreateScheduledMessageBodySchema>;
