/**
 * Export Report Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, ExportFormatSchema, IdSchema } from './report.schemas.js';

export const ExportReportQuerySchema = z.object({
  format: ExportFormatSchema,
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  departmentId: IdSchema.optional(),
  teamId: IdSchema.optional(),
});

export class ExportReportQueryDto extends createZodDto(ExportReportQuerySchema) {}
