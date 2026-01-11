/**
 * Delete Area Query DTO
 *
 * Validation schema for delete area query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Delete area query parameters schema
 */
export const DeleteAreaQuerySchema = z.object({
  force: z.preprocess(
    (val: unknown) => val === 'true' || val === true,
    z.boolean().optional().default(false),
  ),
});

/**
 * Delete Area Query DTO class
 */
export class DeleteAreaQueryDto extends createZodDto(DeleteAreaQuerySchema) {}
