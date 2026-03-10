/**
 * Assign Halls DTO
 *
 * Validation schema for bulk assigning halls to an area.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AssignHallsSchema = z.object({
  hallIds: z
    .array(
      z.coerce.number().int().positive('Hall ID must be a positive integer'),
    )
    .min(0, 'Hall IDs must be an array'),
});

export class AssignHallsDto extends createZodDto(AssignHallsSchema) {}
