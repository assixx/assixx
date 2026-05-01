/**
 * DTOs for Documents Query Parameters
 *
 * Phase 1.2a (2026-05-01): extends canonical PaginationSchema (ADR-030 §4 + audit D1).
 * limit default 20 (preserved); search tightened from .max(200) to .trim().max(100)
 * per D3 convention. Schema renamed to PascalCase + exported for consistency
 * with other module schemas.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Access scope values
 */
const ACCESS_SCOPE_VALUES = [
  'personal',
  'team',
  'department',
  'company',
  'payroll',
  'blackboard',
  'chat',
] as const;

/**
 * List documents query schema
 */
export const ListDocumentsQuerySchema = PaginationSchema.extend({
  // Override default limit (PaginationSchema = 10) — documents-list-Default war historisch 20.
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  accessScope: z.enum(ACCESS_SCOPE_VALUES).optional(),
  ownerUserId: z.coerce.number().int().positive().optional(),
  targetTeamId: z.coerce.number().int().positive().optional(),
  targetDepartmentId: z.coerce.number().int().positive().optional(),
  salaryYear: z.coerce.number().int().min(2000).max(2100).optional(),
  salaryMonth: z.coerce.number().int().min(1).max(12).optional(),
  blackboardEntryId: z.coerce.number().int().positive().optional(),
  conversationId: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional().default(1),
  search: z.string().trim().max(100).optional(),
});

export class ListDocumentsQueryDto extends createZodDto(ListDocumentsQuerySchema) {}
