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
  // `.default(false)` outside preprocess — Zod 4.x broke
  // `z.preprocess(fn, z.boolean().optional().default(false))`. ADR-030 §4.
  // `.default()` already covers the missing-key case (no separate `.optional()`
  // needed). Same regression that forced the PaginationSchema migration.
  force: z.preprocess((val: unknown) => val === 'true' || val === true, z.boolean()).default(false),
});

/**
 * Delete Area Query DTO class
 */
export class DeleteAreaQueryDto extends createZodDto(DeleteAreaQuerySchema) {}
