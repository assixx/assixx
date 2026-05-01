/**
 * List Departments Query DTO
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
 * List departments query parameters
 */
export const ListDepartmentsQuerySchema = z.object({
  // `.optional()` outside preprocess (Zod 4.x regression). ADR-030 §4.
  includeExtended: z.preprocess(coerceToBooleanOrPassthrough, z.boolean()).optional(),
});

/**
 * List Departments Query DTO class
 */
export class ListDepartmentsQueryDto extends createZodDto(ListDepartmentsQuerySchema) {}
