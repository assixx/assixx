/**
 * Export Entries DTO
 *
 * Query parameters for exporting audit entries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from '../../../schemas/common.schema.js';

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['json', 'csv'], {
  message: 'Format must be json or csv',
});

/**
 * Export entries query schema
 */
export const ExportEntriesQuerySchema = z.object({
  format: ExportFormatSchema.optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

/**
 * DTO for export entries query parameters
 */
export class ExportEntriesQueryDto extends createZodDto(ExportEntriesQuerySchema) {}
