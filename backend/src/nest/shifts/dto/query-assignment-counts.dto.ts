/**
 * Query Assignment Counts DTO
 *
 * Validates query params for GET /shifts/assignment-counts.
 * Returns per-employee shift counts for week, month, and year.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

export const QueryAssignmentCountsSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  referenceDate: ShiftDateSchema,
});

export class QueryAssignmentCountsDto extends createZodDto(
  QueryAssignmentCountsSchema,
) {}
