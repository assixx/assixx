/**
 * Audit Trail API v2 Validation with Zod
 * Replaces express-validator with Zod for audit trail endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Audit trail status enum
 */
const AuditStatusSchema = z.enum(['success', 'failure'], {
  message: 'Status must be success or failure',
});

/**
 * Report type enum for compliance reports
 */
const ReportTypeSchema = z.enum(['gdpr', 'data_access', 'data_changes', 'user_activity'], {
  message: 'Invalid report type',
});

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['json', 'csv'], {
  message: 'Format must be json or csv',
});

/**
 * Sort field enum for audit entries
 */
const SortBySchema = z.enum(['created_at', 'action', 'user_id', 'resource_type'], {
  message: 'Invalid sort field',
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get audit entries query parameters
 */
export const GetEntriesQuerySchema = PaginationSchema.extend({
  userId: IdSchema.optional(),
  action: z.string().trim().optional(),
  resourceType: z.string().trim().optional(),
  resourceId: IdSchema.optional(),
  status: AuditStatusSchema.optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  search: z.string().trim().optional(),
  sortBy: SortBySchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Get statistics query parameters
 */
export const GetStatsQuerySchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

/**
 * Export entries query parameters
 */
export const ExportEntriesQuerySchema = z.object({
  format: ExportFormatSchema.optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Audit entry ID parameter validation
 */
export const AuditEntryIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Generate compliance report request body
 */
export const GenerateReportBodySchema = z
  .object({
    reportType: ReportTypeSchema,
    dateFrom: DateSchema,
    dateTo: DateSchema,
  })
  .refine(
    (data: { reportType: string; dateFrom: string; dateTo: string }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      return dateTo >= dateFrom;
    },
    {
      message: 'Date to must be after date from',
      path: ['dateTo'],
    },
  )
  .refine(
    (data: { reportType: string; dateFrom: string; dateTo: string }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      const maxDate = new Date(dateFrom);
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      return dateTo <= maxDate;
    },
    {
      message: 'Date range cannot exceed 1 year',
      path: ['dateTo'],
    },
  );

/**
 * Delete old entries request body
 */
export const DeleteOldEntriesBodySchema = z.object({
  olderThanDays: z.number().int().min(90, 'Must specify days (minimum 90)'),
  confirmPassword: z.string().min(1, 'Password confirmation required for this action'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GetEntriesQuery = z.infer<typeof GetEntriesQuerySchema>;
export type GetStatsQuery = z.infer<typeof GetStatsQuerySchema>;
export type ExportEntriesQuery = z.infer<typeof ExportEntriesQuerySchema>;
export type AuditEntryIdParam = z.infer<typeof AuditEntryIdParamSchema>;
export type GenerateReportBody = z.infer<typeof GenerateReportBodySchema>;
export type DeleteOldEntriesBody = z.infer<typeof DeleteOldEntriesBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for audit trail routes
 */
export const auditTrailValidationZod = {
  getEntries: validateQuery(GetEntriesQuerySchema),
  getEntry: validateParams(AuditEntryIdParamSchema),
  getStats: validateQuery(GetStatsQuerySchema),
  generateReport: validateBody(GenerateReportBodySchema),
  exportEntries: validateQuery(ExportEntriesQuerySchema),
  deleteOldEntries: validateBody(DeleteOldEntriesBodySchema),
};
