/**
 * Approvals — List Query DTO
 *
 * Validates query parameters for GET /approvals (listAll) and GET /approvals/assigned (getAssigned).
 * All filter fields optional, pagination required.
 *
 * Pagination via canonical PaginationSchema (ADR-030 §4 + Phase 1.2b, 2026-05-02):
 * extends central schema; per-endpoint override sets `limit` default=20 to preserve the
 * historical service-side fallback (`filters.limit ?? 20` in `approvals.service.ts`).
 * Limit max=100 inherited from PaginationSchema.
 *
 * `search` field follows D3 convention: .trim().max(100).optional() — service layer
 * treats `undefined`/empty string as "no WHERE clause" (backwards-compat invariant).
 *
 * WHY this DTO replaces an inline TS interface (Phase-1-audit.md row §6c):
 * the previous inline `ListApprovalsQuery` (approvals.controller.ts:52, removed in this
 * refactor) typed `page`/`limit` as `string` and required manual `Number(...)` coercion in
 * the controller — bypassing the global `ZodValidationPipe`. With the DTO every query
 * param is validated AND coerced to its target type once, at the framework boundary.
 *
 * Both controller methods consume this DTO. `getAssigned` only forwards
 * `status` + `page` + `limit` to the service (existing behavior preserved); the DTO's
 * other accepted fields (`search`, `addonCode`, `priority`) are silently ignored on that
 * route — same pattern as the legacy inline interface, which already accepted but
 * dropped `addonCode`/`priority` for the assignee endpoint.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/** Approval status — mirrors ApprovalStatus type in approvals.types.ts */
const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected'], {
  message: 'Invalid status (pending | approved | rejected)',
});

/** Approval priority — mirrors ApprovalPriority type in approvals.types.ts */
const ApprovalPrioritySchema = z.enum(['low', 'medium', 'high'], {
  message: 'Invalid priority (low | medium | high)',
});

export const ListApprovalsQuerySchema = PaginationSchema.extend({
  // Override default limit (PaginationSchema = 10) to 20 — matches the historical
  // hardcoded fallback `filters.limit ?? 20` in approvals.service.ts findAll/findByAssignee.
  // Max=100 inherited unchanged from PaginationSchema (no override needed).
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: ApprovalStatusSchema.optional(),
  addonCode: z.string().trim().min(1).max(50).optional(),
  priority: ApprovalPrioritySchema.optional(),
});

export class ListApprovalsQueryDto extends createZodDto(ListApprovalsQuerySchema) {}
