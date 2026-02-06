/**
 * Dashboard Blackboard Query DTO
 *
 * Validation schema for dashboard widget blackboard entries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Dashboard entries query parameters schema
 */
export const DashboardQuerySchema = z.object({
  limit: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' ? Number.parseInt(val, 10) : val,
    z
      .number()
      .int()
      .min(1)
      .max(10, 'Limit must be between 1 and 10')
      .optional(),
  ),
});

/**
 * Dashboard Query DTO class
 */
export class DashboardQueryDto extends createZodDto(DashboardQuerySchema) {}
