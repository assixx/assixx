/**
 * Logs API v2 Validation with Zod
 * Replaces express-validator with Zod for logs endpoints
 */
import { z } from 'zod';

import { validateBody, validateQuery } from '../../../middleware/validation.zod.js';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List logs query parameters
 */
export const ListLogsQuerySchema = PaginationSchema.extend({
  userId: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: z.string().trim().min(1, 'Action must be a non-empty string').optional(),
  entityType: z.string().trim().min(1, 'Entity type must be a non-empty string').optional(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  search: z.string().trim().optional(),
  offset: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(0, 'Offset must be a non-negative integer').optional(),
  ),
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Delete logs request body
 * search: Multi-field search across users, departments, areas, teams
 */
export const DeleteLogsBodySchema = z.object({
  userId: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: z.string().trim().min(1, 'Action must be a non-empty string').optional(),
  entityType: z.string().trim().min(1, 'Entity type must be a non-empty string').optional(),
  olderThanDays: z.number().int().min(0, 'Days must be a non-negative integer').optional(),
  search: z.string().trim().optional(),
  confirmPassword: z.string().min(1, 'Password confirmation is required for log deletion'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListLogsQuery = z.infer<typeof ListLogsQuerySchema>;
export type DeleteLogsBody = z.infer<typeof DeleteLogsBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for logs routes
 */
export const logsValidationZod = {
  listLogs: validateQuery(ListLogsQuerySchema),
  deleteLogs: validateBody(DeleteLogsBodySchema),
};
