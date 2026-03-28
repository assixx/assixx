/**
 * Upcoming Maintenance Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpcomingMaintenanceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export class UpcomingMaintenanceQueryDto extends createZodDto(UpcomingMaintenanceQuerySchema) {}
