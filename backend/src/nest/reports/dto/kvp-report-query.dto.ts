/**
 * KVP Report Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema } from './report.schemas.js';

export const KvpReportQuerySchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  categoryId: IdSchema.optional(),
});

export class KvpReportQueryDto extends createZodDto(KvpReportQuerySchema) {}
