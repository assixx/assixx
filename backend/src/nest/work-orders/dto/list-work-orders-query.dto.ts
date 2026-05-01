/**
 * Work Orders — List Query DTO
 *
 * Validates query parameters for GET /work-orders and GET /work-orders/my.
 * All filter fields optional, pagination required.
 *
 * Pagination via canonical PaginationSchema (ADR-030 §4 + Phase 1.2a-B, 2026-05-01):
 * extends central schema; per-endpoint overrides limit default=20 (was historical
 * default for work orders) and limit max=100 (D2: tightened from local LimitSchema's
 * 500 cap — 500 was unjustified for a list page; PaginationSchema's 100 ceiling is
 * the canonical max). The local `LimitSchema/PageSchema` in `./common.dto.ts`
 * remain in place — they are still exported and still covered by their own DTO tests
 * but no longer consumed by any in-scope DTO. Phase 5.2 will remove them.
 *
 * `search` field follows D3 convention: .trim().max(100).optional() — service layer
 * treats `undefined`/empty string as "no WHERE clause" (backwards-compat invariant).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';
import {
  WorkOrderPrioritySchema,
  WorkOrderSourceTypeSchema,
  WorkOrderStatusSchema,
} from './common.dto.js';

/** Accepted values for the isActive filter query parameter */
const IsActiveFilterSchema = z.enum(['active', 'archived', 'all'], {
  message: 'Ungültiger is_active Filter (active | archived | all)',
});

export const ListWorkOrdersQuerySchema = PaginationSchema.extend({
  // Override default limit (PaginationSchema = 10) — work orders historically default to 20.
  // D2: max=100 (was 500 in local LimitSchema — 500 was unjustified, single page never needs that).
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: WorkOrderStatusSchema.optional(),
  priority: WorkOrderPrioritySchema.optional(),
  sourceType: WorkOrderSourceTypeSchema.optional(),
  sourceUuid: z.uuid().optional(),
  assigneeUuid: z.uuid().optional(),
  isActive: IsActiveFilterSchema.optional(),
  /** Filter: only overdue items (due_date < today AND status not done). Send "true" to enable. */
  overdue: z.enum(['true']).optional(),
});

export class ListWorkOrdersQueryDto extends createZodDto(ListWorkOrdersQuerySchema) {}
