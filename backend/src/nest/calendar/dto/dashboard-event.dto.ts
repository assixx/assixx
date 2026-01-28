/**
 * Dashboard Event DTO
 *
 * Validation schema for dashboard events query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Dashboard events query parameters
 */
export const DashboardEventsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Dashboard Events Query DTO class
 */
export class DashboardEventsQueryDto extends createZodDto(
  DashboardEventsQuerySchema,
) {}
