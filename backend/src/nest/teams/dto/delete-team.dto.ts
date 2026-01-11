/**
 * Delete Team DTO
 *
 * Validation schema for delete query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Coerce various input types to boolean
 */
function coerceToBooleanOrPassthrough(val: unknown): unknown {
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  if (val === 1) return true;
  if (val === 0) return false;
  return val;
}

/**
 * Delete team query parameters
 */
export const DeleteTeamQuerySchema = z.object({
  force: z.preprocess(coerceToBooleanOrPassthrough, z.boolean().optional()),
});

/**
 * Delete Team Query DTO class
 */
export class DeleteTeamQueryDto extends createZodDto(DeleteTeamQuerySchema) {}
