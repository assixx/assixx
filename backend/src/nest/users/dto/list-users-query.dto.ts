/**
 * List Users Query DTO
 *
 * Validation schema for list query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PaginationSchema,
  RoleSchema,
} from '../../../schemas/common.schema.js';

/**
 * List users query parameters
 */
export const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().trim().optional(),
  role: RoleSchema.optional(),
  isActive: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' ? Number.parseInt(val, 10) : val,
    z.number().int().min(0).max(4).optional(),
  ),
  sortBy: z
    .enum(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * List Users Query DTO class
 */
export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
