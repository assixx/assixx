/**
 * Calendar Shifts DTO
 *
 * Zod schemas for calendar shift queries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * My calendar shifts query parameters
 */
export const QueryMyCalendarShiftsSchema = z.object({
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
});

export class QueryMyCalendarShiftsDto extends createZodDto(QueryMyCalendarShiftsSchema) {}
