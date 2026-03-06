/**
 * Query Shift Plan DTO
 *
 * Zod schema for shift plan query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Get shift plan query parameters
 */
export const QueryShiftPlanSchema = z.object({
  areaId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  assetId: z.coerce.number().int().positive().optional(),
  startDate: ShiftDateSchema.optional(),
  endDate: ShiftDateSchema.optional(),
});

export class QueryShiftPlanDto extends createZodDto(QueryShiftPlanSchema) {}
