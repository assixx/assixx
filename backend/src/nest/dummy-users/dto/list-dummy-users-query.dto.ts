/**
 * Dummy Users — List Query DTO
 *
 * Validates query parameters for GET /dummy-users.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IsActiveSchema, LimitSchema, PageSchema } from './common.dto.js';

export const ListDummyUsersQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: z.string().trim().optional(),
  isActive: IsActiveSchema.optional(),
});

export class ListDummyUsersQueryDto extends createZodDto(
  ListDummyUsersQuerySchema,
) {}
