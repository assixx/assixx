/**
 * Shift Report Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema } from './report.schemas.js';

export const ShiftReportQuerySchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  departmentId: IdSchema.optional(),
  teamId: IdSchema.optional(),
});

export class ShiftReportQueryDto extends createZodDto(ShiftReportQuerySchema) {}
