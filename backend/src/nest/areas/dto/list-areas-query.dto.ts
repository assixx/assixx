/**
 * List Areas Query DTO
 *
 * Validation schema for listing areas with filters.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AreaTypeSchema } from './create-area.dto.js';

/**
 * List areas query parameters schema
 */
export const ListAreasQuerySchema = z.object({
  type: AreaTypeSchema.optional(),
  // `z.coerce.number()` per ADR-030 §4 — replaces broken `z.preprocess(...,
  // z.number().optional())` form (Zod 4.x: inner `.optional()` reports
  // "expected nonoptional, received undefined" when the field is missing).
  isActive: z.coerce.number().int().min(0).max(4).optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be at least 1 character')
    .max(100, 'Search term must not exceed 100 characters')
    .optional(),
});

/**
 * List Areas Query DTO class
 */
export class ListAreasQueryDto extends createZodDto(ListAreasQuerySchema) {}
