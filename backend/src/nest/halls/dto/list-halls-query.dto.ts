/**
 * List Halls Query DTO
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

/**
 * `.optional()` MUST sit on the outer wrapper (after `z.preprocess`) — Zod 4.x
 * broke the inner-`.optional()` form: `z.preprocess(fn, z.boolean().optional())`
 * reports "expected nonoptional, received undefined" when the field is missing
 * from the query string, because preprocess consumes the missing-key signal
 * before the optional check fires. Same regression that forced the
 * PaginationSchema migration (common.schema.ts, 2026-04-30) — see ADR-030 §4.
 */
export const ListHallsQuerySchema = z.object({
  includeExtended: z.preprocess(coerceToBooleanOrPassthrough, z.boolean()).optional(),
});

export class ListHallsQueryDto extends createZodDto(ListHallsQuerySchema) {}
