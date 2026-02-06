/**
 * Rotation Delete DTO
 *
 * Zod schema for deleting rotation history.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Delete rotation history parameters
 * API v2: camelCase only
 *
 * - If only teamId: deletes ALL patterns for the team
 * - If teamId + patternId: deletes ONLY that specific pattern
 */
export const DeleteRotationHistorySchema = z.object({
  teamId: z.coerce.number().int().positive('teamId is required'),
  patternId: z.coerce.number().int().positive().optional(),
});

export class DeleteRotationHistoryDto extends createZodDto(
  DeleteRotationHistorySchema,
) {}
