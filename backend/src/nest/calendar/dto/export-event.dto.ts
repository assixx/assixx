/**
 * Export Event DTO
 *
 * Validation schema for export query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['ics', 'csv'], {
  message: 'Valid format is required (ics or csv)',
});

/**
 * Export events query parameters
 */
export const ExportEventsQuerySchema = z.object({
  format: ExportFormatSchema,
});

/**
 * Export Events Query DTO class
 */
export class ExportEventsQueryDto extends createZodDto(ExportEventsQuerySchema) {}
