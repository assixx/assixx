/**
 * List Users Query DTO
 *
 * Validation schema for list query parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema, RoleSchema } from '../../../schemas/common.schema.js';

/**
 * List users query parameters
 *
 * `isActive` uses `z.coerce.number()` per ADR-030 §4 (z.coerce over z.preprocess).
 * Zod 4.x broke `z.preprocess(fn, schema.optional())` for missing query params:
 * the inner `.optional()` reports "expected nonoptional, received undefined"
 * because preprocess swallows the missing-key signal. Same regression that
 * forced the PaginationSchema migration (common.schema.ts, 2026-04-30).
 */
export const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().trim().optional(),
  role: RoleSchema.optional(),
  position: z.string().trim().optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional(),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * List Users Query DTO class
 */
export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
