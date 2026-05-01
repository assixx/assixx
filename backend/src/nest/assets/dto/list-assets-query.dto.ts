/**
 * List Assets Query DTO
 *
 * Pagination via canonical PaginationSchema (ADR-030 §4 + Phase 1.2a, 2026-05-01):
 * extends central schema instead of redefining page/limit. `limit` default
 * preserved at 20 via .extend() override (D1 — per-endpoint defaults bleiben).
 * `search` field follows D3 convention: .trim().max(100).optional().
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

const AssetStatusEnum = z.enum([
  'operational',
  'maintenance',
  'repair',
  'standby',
  'decommissioned',
]);

const AssetTypeEnum = z.enum([
  'production',
  'packaging',
  'quality_control',
  'logistics',
  'utility',
  'other',
]);

const SortByEnum = z.enum(['created_at', 'updated_at', 'name', 'next_maintenance']);
const SortOrderEnum = z.enum(['asc', 'desc']);

export const ListAssetsQuerySchema = PaginationSchema.extend({
  // Override default limit (PaginationSchema = 10) — assets-list-Default war historisch 20.
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: AssetStatusEnum.optional(),
  assetType: AssetTypeEnum.optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  needsMaintenance: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  sortBy: SortByEnum.optional().default('created_at'),
  sortOrder: SortOrderEnum.optional().default('desc'),
});

export class ListAssetsQueryDto extends createZodDto(ListAssetsQuerySchema) {}
