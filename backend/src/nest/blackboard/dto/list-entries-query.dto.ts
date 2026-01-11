/**
 * List Blackboard Entries Query DTO
 *
 * Validation schema for listing and filtering blackboard entries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Entry status enum
 */
const EntryStatusSchema = z.enum(['active', 'archived'], {
  message: "Status must be 'active' or 'archived'",
});

/**
 * Filter type enum
 */
const FilterSchema = z.enum(['all', 'company', 'department', 'team', 'area'], {
  message: 'Filter must be one of: all, company, department, team, area',
});

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  message: 'Invalid priority value',
});

/**
 * Sort field enum
 */
const SortBySchema = z.enum(['created_at', 'updated_at', 'title', 'priority', 'expires_at'], {
  message: 'Invalid sort field',
});

/**
 * Sort direction enum
 */
const SortDirSchema = z.enum(['ASC', 'DESC'], {
  message: 'Sort direction must be ASC or DESC',
});

/**
 * List blackboard entries query parameters schema
 */
export const ListEntriesQuerySchema = PaginationSchema.extend({
  status: EntryStatusSchema.optional(),
  filter: FilterSchema.optional(),
  search: z.string().trim().max(100, 'Search term cannot exceed 100 characters').optional(),
  sortBy: SortBySchema.optional(),
  sortDir: SortDirSchema.optional(),
  priority: PrioritySchema.optional(),
});

/**
 * List Entries Query DTO class
 */
export class ListEntriesQueryDto extends createZodDto(ListEntriesQuerySchema) {}
