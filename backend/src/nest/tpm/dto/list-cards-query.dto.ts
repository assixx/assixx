/**
 * TPM List Cards Query DTO
 *
 * Filter + pagination query parameters for GET /tpm/cards.
 * At least one of assetUuid, planUuid, or status is required
 * (enforced in controller, not in schema — keeps schema composable).
 *
 * Pagination via canonical PaginationSchema (ADR-030 §4 + Phase 1.2a-B, 2026-05-01):
 * extends central schema; per-endpoint override sets `limit` default=20 and max=100
 * (D2: tightened from local LimitSchema's 500 cap). The local `PageSchema/LimitSchema`
 * in `./common.dto.ts` remain in place for 3 out-of-scope DTOs (executions,
 * revisions, board); Phase 5.2 will consolidate them.
 *
 * `search` follows D3 convention: .trim().max(100).optional() — service treats
 * `undefined`/empty string as "no WHERE clause" (backwards-compat invariant).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';
import {
  TpmCardCategorySchema,
  TpmCardRoleSchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
} from './common.dto.js';

export const ListCardsQuerySchema = PaginationSchema.extend({
  // Override default limit (PaginationSchema = 10) — TPM cards historically default to 20.
  // D2: max=100 (was 500 in local LimitSchema).
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  assetUuid: z.uuid().optional(),
  planUuid: z.uuid().optional(),
  status: TpmCardStatusSchema.optional(),
  intervalType: TpmIntervalTypeSchema.optional(),
  cardRole: TpmCardRoleSchema.optional(),
  cardCategory: TpmCardCategorySchema.optional(),
});

export class ListCardsQueryDto extends createZodDto(ListCardsQuerySchema) {}
