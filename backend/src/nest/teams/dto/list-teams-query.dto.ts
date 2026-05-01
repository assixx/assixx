/**
 * List Teams Query DTO
 *
 * Validation schema for list query parameters.
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
 * List teams query parameters
 */
export const ListTeamsQuerySchema = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be at least 1 character')
    .max(100, 'Search term must not exceed 100 characters')
    .optional(),
  // `.optional()` outside preprocess: Zod 4.x broke the inner-`.optional()`
  // form. See ADR-030 §4 + PaginationSchema migration (2026-04-30).
  includeMembers: z.preprocess(coerceToBooleanOrPassthrough, z.boolean()).optional(),
});

/**
 * List Teams Query DTO class
 */
export class ListTeamsQueryDto extends createZodDto(ListTeamsQuerySchema) {}
