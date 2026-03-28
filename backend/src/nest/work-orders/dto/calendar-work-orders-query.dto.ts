/**
 * Work Orders — Calendar Query DTO
 *
 * Validates query parameters for GET /work-orders/calendar.
 * Expects ISO date strings (YYYY-MM-DD) for date range filtering.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum (YYYY-MM-DD)');

export const CalendarWorkOrdersQuerySchema = z.object({
  startDate: DateStringSchema,
  endDate: DateStringSchema,
});

export class CalendarWorkOrdersQueryDto extends createZodDto(CalendarWorkOrdersQuerySchema) {}
