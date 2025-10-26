/**
 * Reports/Analytics API v2 Validation with Zod
 * Replaces express-validator with Zod for reports endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { DateSchema, IdSchema } from '../../../schemas/common.schema';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Metrics enum for custom reports
 */
const MetricSchema = z.enum(
  ['employees', 'departments', 'shifts', 'kvp', 'attendance', 'compliance'],
  {
    message: 'Invalid metric selected',
  },
);

/**
 * Group by enum
 */
const GroupBySchema = z.enum(['department', 'team', 'week', 'month'], {
  message: 'Invalid groupBy value',
});

/**
 * Report type enum for exports
 */
const ReportTypeSchema = z.enum(
  ['overview', 'employees', 'departments', 'shifts', 'kvp', 'attendance', 'compliance'],
  {
    message: 'Invalid report type',
  },
);

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['pdf', 'excel', 'csv'], {
  message: 'Format must be pdf, excel, or csv',
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Basic date range query schema (without refine for extension)
 */
const BaseDateRangeSchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

/**
 * Helper function to add date validation
 * @returns A refined Zod schema with date range validation
 */
function withDateValidation(schema: z.ZodType): z.ZodType {
  return schema.refine(
    (data: unknown) => {
      const dateData = data as { dateFrom?: string; dateTo?: string };
      if (dateData.dateFrom && dateData.dateTo) {
        return new Date(dateData.dateTo) >= new Date(dateData.dateFrom);
      }
      return true;
    },
    {
      message: 'dateTo must be after dateFrom',
      path: ['dateTo'],
    },
  );
}

/**
 * Basic date range query schema with validation
 */
export const DateRangeQuerySchema = withDateValidation(BaseDateRangeSchema);

/**
 * Employee report query parameters
 */
export const EmployeeReportQuerySchema = withDateValidation(
  BaseDateRangeSchema.extend({
    departmentId: IdSchema.optional(),
    teamId: IdSchema.optional(),
  }),
);

/**
 * Shift report query parameters
 */
export const ShiftReportQuerySchema = withDateValidation(
  BaseDateRangeSchema.extend({
    departmentId: IdSchema.optional(),
    teamId: IdSchema.optional(),
  }),
);

/**
 * KVP report query parameters
 */
export const KvpReportQuerySchema = withDateValidation(
  BaseDateRangeSchema.extend({
    categoryId: IdSchema.optional(),
  }),
);

/**
 * Attendance report query parameters (dateFrom and dateTo required)
 */
export const AttendanceReportQuerySchema = z
  .object({
    dateFrom: DateSchema,
    dateTo: DateSchema,
    departmentId: IdSchema.optional(),
    teamId: IdSchema.optional(),
  })
  .refine(
    (data: { dateFrom: string; dateTo: string; departmentId?: number; teamId?: number }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      return dateTo >= dateFrom;
    },
    {
      message: 'dateTo must be after dateFrom',
      path: ['dateTo'],
    },
  )
  .refine(
    (data: { dateFrom: string; dateTo: string; departmentId?: number; teamId?: number }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 90;
    },
    {
      message: 'Date range cannot exceed 90 days',
      path: ['dateTo'],
    },
  );

/**
 * Export report query parameters
 */
export const ExportReportQuerySchema = withDateValidation(
  BaseDateRangeSchema.extend({
    format: ExportFormatSchema,
    departmentId: IdSchema.optional(),
    teamId: IdSchema.optional(),
  }),
);

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Report type parameter validation
 */
export const ReportTypeParamSchema = z.object({
  type: ReportTypeSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Custom report request body
 */
export const CustomReportBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name must not exceed 100 characters'),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
    metrics: z.array(MetricSchema).min(1, 'At least one metric must be selected'),
    dateFrom: DateSchema,
    dateTo: DateSchema,
    filters: z
      .object({
        departmentIds: z.array(IdSchema).optional(),
        teamIds: z.array(IdSchema).optional(),
      })
      .optional(),
    groupBy: GroupBySchema.optional(),
  })
  .refine(
    (data: {
      name: string;
      description?: string;
      metrics: string[];
      dateFrom: string;
      dateTo: string;
      filters?: { departmentIds?: number[]; teamIds?: number[] };
      groupBy?: string;
    }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      return dateTo >= dateFrom;
    },
    {
      message: 'dateTo must be after dateFrom',
      path: ['dateTo'],
    },
  );

// ============================================================
// TYPE EXPORTS
// ============================================================

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;
export type EmployeeReportQuery = z.infer<typeof EmployeeReportQuerySchema>;
export type ShiftReportQuery = z.infer<typeof ShiftReportQuerySchema>;
export type KvpReportQuery = z.infer<typeof KvpReportQuerySchema>;
export type AttendanceReportQuery = z.infer<typeof AttendanceReportQuerySchema>;
export type ExportReportQuery = z.infer<typeof ExportReportQuerySchema>;
export type ReportTypeParam = z.infer<typeof ReportTypeParamSchema>;
export type CustomReportBody = z.infer<typeof CustomReportBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for reports routes
 */
export const reportsValidationZod = {
  dateRange: validateQuery(DateRangeQuerySchema),
  employeeReport: validateQuery(EmployeeReportQuerySchema),
  shiftReport: validateQuery(ShiftReportQuerySchema),
  kvpReport: validateQuery(KvpReportQuerySchema),
  attendanceReport: validateQuery(AttendanceReportQuerySchema),
  customReport: validateBody(CustomReportBodySchema),
  exportReport: [validateParams(ReportTypeParamSchema), validateQuery(ExportReportQuerySchema)],
};
