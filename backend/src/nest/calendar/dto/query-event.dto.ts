/**
 * Query Event DTOs
 *
 * Validation schemas for list events query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Event status enum
 */
const EventStatusSchema = z.enum(['active', 'cancelled'], {
  message: 'Valid event status is required',
});

/**
 * Sort by field enum
 */
const SortBySchema = z.enum(['startDate', 'endDate', 'title', 'createdAt'], {
  message: 'Valid sort field is required',
});

/**
 * Sort order enum
 */
const SortOrderSchema = z.enum(['asc', 'desc'], {
  message: 'Valid sort order is required',
});

/**
 * List events query parameters
 */
export const ListEventsQuerySchema = z.object({
  status: EventStatusSchema.optional(),
  filter: z.enum(['all', 'company', 'department', 'team', 'area', 'personal']).optional(),
  search: z.string().optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: SortBySchema.optional(),
  sortOrder: SortOrderSchema.optional(),
});

/**
 * List Events Query DTO class
 */
export class ListEventsQueryDto extends createZodDto(ListEventsQuerySchema) {}
