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

export const ListHallsQuerySchema = z.object({
  includeExtended: z.preprocess(coerceToBooleanOrPassthrough, z.boolean().optional()),
});

export class ListHallsQueryDto extends createZodDto(ListHallsQuerySchema) {}
