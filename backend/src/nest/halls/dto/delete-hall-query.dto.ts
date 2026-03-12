/**
 * Delete Hall DTO
 *
 * Validation schema for delete query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

function coerceToBooleanOrPassthrough(val: unknown): unknown {
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  if (val === 1) return true;
  if (val === 0) return false;
  return val;
}

export const DeleteHallQuerySchema = z.object({
  force: z.preprocess(coerceToBooleanOrPassthrough, z.boolean().optional()),
});

export class DeleteHallQueryDto extends createZodDto(DeleteHallQuerySchema) {}
