/**
 * Query KVP Suggestion DTOs
 *
 * Validation schemas for listing and filtering KVP suggestions.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * KVP suggestion status enum
 */
const StatusSchema = z.enum(
  ['new', 'in_review', 'approved', 'implemented', 'rejected', 'archived'],
  {
    message: 'Invalid status value',
  },
);

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Invalid priority value',
});

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'area', 'team'], {
  message: 'Invalid organization level',
});

/**
 * List suggestions query parameters schema
 */
export const ListSuggestionsQuerySchema = PaginationSchema.extend({
  status: StatusSchema.optional(),
  categoryId: IdSchema.optional(),
  priority: PrioritySchema.optional(),
  orgLevel: OrgLevelSchema.optional(),
  search: z.string().trim().max(100, 'Search query too long').optional(),
  mineOnly: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
});

/**
 * List Suggestions Query DTO class
 */
export class ListSuggestionsQueryDto extends createZodDto(
  ListSuggestionsQuerySchema,
) {}
