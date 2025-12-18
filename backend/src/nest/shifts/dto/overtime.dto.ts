/**
 * Overtime DTO
 *
 * Zod schema for overtime report queries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Get overtime report query parameters
 */
export const QueryOvertimeSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
});

export class QueryOvertimeDto extends createZodDto(QueryOvertimeSchema) {}
