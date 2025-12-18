/**
 * Export Responses DTO
 *
 * Validation schema for exporting survey responses.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['csv', 'excel'], {
  message: 'Format must be csv or excel',
});

/**
 * Export responses query parameters schema
 */
export const ExportResponsesQuerySchema = z.object({
  format: ExportFormatSchema.optional(),
});

/**
 * Export Responses Query DTO class
 */
export class ExportResponsesQueryDto extends createZodDto(ExportResponsesQuerySchema) {}
