/**
 * Conversation Participants DTOs
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddParticipantsBodySchema = z.object({
  participantIds: z
    .array(z.number().int().min(1, 'Invalid participant ID'))
    .min(1, 'At least one participant is required'),
});

export class AddParticipantsDto extends createZodDto(AddParticipantsBodySchema) {}

// Type exports
export type AddParticipantsBody = z.infer<typeof AddParticipantsBodySchema>;
