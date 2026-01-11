/**
 * Remove Participant Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RemoveParticipantParamsSchema = z.object({
  id: z.coerce.number().int('Conversation ID must be an integer').min(1, 'Invalid conversation ID'),
  userId: z.coerce.number().int('User ID must be an integer').min(1, 'Invalid user ID'),
});

export class RemoveParticipantParamsDto extends createZodDto(RemoveParticipantParamsSchema) {}

// Type export
export type RemoveParticipantParams = z.infer<typeof RemoveParticipantParamsSchema>;
