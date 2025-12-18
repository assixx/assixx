/**
 * Rotation Delete DTO
 *
 * Zod schema for deleting all rotation history.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Delete all rotation history parameters
 */
export const DeleteRotationHistorySchema = z.object({
  team_id: z.coerce.number().int().positive('team_id is required'),
});

export class DeleteRotationHistoryDto extends createZodDto(DeleteRotationHistorySchema) {}
