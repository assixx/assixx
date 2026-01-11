/**
 * Query Shifts DTO
 *
 * Zod schema for shift listing and filtering.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ShiftDateSchema,
  ShiftStatusSchema,
  ShiftTypeSchema,
  SortBySchema,
  SortOrderSchema,
} from './common.dto.js';

/**
 * List shifts query parameters
 */
export const QueryShiftsSchema = z.object({
  date: ShiftDateSchema.optional(),
  startDate: ShiftDateSchema.optional(),
  endDate: ShiftDateSchema.optional(),
  userId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  templateId: z.coerce.number().int().positive().optional(),
  planId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: SortBySchema.default('date'),
  sortOrder: SortOrderSchema.default('desc'),
});

export class QueryShiftsDto extends createZodDto(QueryShiftsSchema) {}
