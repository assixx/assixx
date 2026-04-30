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
  // `z.coerce.number()` per ADR-030 §4 — replaces broken `z.preprocess(...,
  // z.number().optional())` (Zod 4.x regression: inner `.optional()` reports
  // "expected nonoptional, received undefined" when the field is missing).
  limit: z.coerce.number().int().min(1).max(10, 'Limit must be between 1 and 10').optional(),
});

/**
 * Dashboard Query DTO class
 */
export class DashboardQueryDto extends createZodDto(DashboardQuerySchema) {}
