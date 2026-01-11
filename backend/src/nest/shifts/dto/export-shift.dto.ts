/**
 * Export Shift DTO
 *
 * Zod schema for shift export queries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Export shifts query parameters
 */
export const ExportShiftsSchema = z.object({
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  format: z.enum(['csv', 'excel']).default('csv'),
});

export class ExportShiftsDto extends createZodDto(ExportShiftsSchema) {}
