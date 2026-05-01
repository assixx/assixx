/**
 * Query Survey DTO
 *
 * Validation schema for listing and filtering surveys.
 *
 * Pagination via canonical PaginationSchema (ADR-030 §4 + Phase 1.2a-B, 2026-05-01):
 * extends central schema; default limit=10 / max=100 inherited unchanged.
 * `search` field follows D3 convention: .trim().max(100).optional() — service
 * layer treats `undefined`/empty string as "no WHERE clause" (backwards-compat).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Survey status enum
 */
const SurveyStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived'], {
  message: 'Invalid status',
});

/**
 * List surveys query parameters schema
 */
export const ListSurveysQuerySchema = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: SurveyStatusSchema.optional(),
  manage: z.coerce.boolean().optional(),
});

/**
 * List Surveys Query DTO class
 */
export class ListSurveysQueryDto extends createZodDto(ListSurveysQuerySchema) {}
