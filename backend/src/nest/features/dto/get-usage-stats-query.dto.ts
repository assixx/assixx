/**
 * Get Usage Stats Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetUsageStatsQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

export class GetUsageStatsQueryDto extends createZodDto(
  GetUsageStatsQuerySchema,
) {}
