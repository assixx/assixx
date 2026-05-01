/**
 * Dummy Users — List Query DTO
 *
 * Validates query parameters for GET /dummy-users.
 *
 * Phase 1.2a (2026-05-01): extends canonical PaginationSchema (ADR-030 §4 + audit D1).
 * limit default 20 preserved via .extend() override; search tightened with .max(100)
 * per D3 convention. Local PageSchema/LimitSchema in dummy-users/dto/common.dto.ts
 * stay (no other consumers in module). Phase 3 rebuild migrates the response shape
 * to ADR-007 envelope — DTO migration here is the prep-work.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';
import { IsActiveSchema } from './common.dto.js';

export const ListDummyUsersQuerySchema = PaginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  isActive: IsActiveSchema.optional(),
});

export class ListDummyUsersQueryDto extends createZodDto(ListDummyUsersQuerySchema) {}
