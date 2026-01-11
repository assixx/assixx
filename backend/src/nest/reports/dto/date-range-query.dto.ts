/**
 * Date Range Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './report.schemas.js';

export const DateRangeQuerySchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

export class DateRangeQueryDto extends createZodDto(DateRangeQuerySchema) {}
