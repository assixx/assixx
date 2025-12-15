/**
 * Shifts API v2 Validation with Zod
 * Replaces express-validator with Zod for shift management endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema, PaginationSchema, TimeSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Shift date schema - accepts both YYYY-MM-DD and ISO 8601 formats
 * Shifts use separate startTime/endTime fields, so date-only format is valid
 */
const ShiftDateSchema = z.string().refine(
  (val: string) => {
    // Accept YYYY-MM-DD or ISO 8601 format
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return dateOnlyPattern.test(val) || isoDatePattern.test(val);
  },
  { message: 'Invalid date format. Use YYYY-MM-DD or ISO 8601 format' },
);

/**
 * Shift status enum
 */
const ShiftStatusSchema = z.enum(
  ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  {
    message: 'Invalid status',
  },
);

/**
 * Shift type enum
 */
const ShiftTypeSchema = z.enum(
  [
    'regular',
    'overtime',
    'standby',
    'vacation',
    'sick',
    'holiday',
    'early',
    'late',
    'night',
    'day',
    'flexible',
    'F', // Frühschicht
    'S', // Spätschicht
    'N', // Nachtschicht
  ],
  {
    message: 'Invalid type',
  },
);

/**
 * Time format with seconds (HH:MM:SS)
 */
const TimeWithSecondsSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Time must be in HH:MM:SS format');

/**
 * Hex color validation
 */
const HexColorSchema = z
  .string()
  .regex(/^#[\dA-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #3498db)');

/**
 * Swap request status enum
 */
const SwapRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled'], {
  message: 'Invalid status',
});

/**
 * Sort field enum for shifts
 */
const SortBySchema = z.enum(['date', 'startTime', 'endTime', 'userId', 'status', 'type'], {
  message: 'Invalid sort field',
});

/**
 * Sort order enum
 */
const SortOrderSchema = z.enum(['asc', 'desc'], {
  message: 'Sort order must be asc or desc',
});

/**
 * Shift block type enum (for custom rotation algorithm)
 */
export const ShiftBlockTypeSchema = z.enum(['early', 'late', 'night'], {
  message: 'Shift type must be early, late, or night',
});

/**
 * Special rule: nth weekday free (e.g., every 4th Sunday free)
 */
export const NthWeekdayFreeRuleSchema = z.object({
  type: z.literal('nth_weekday_free'),
  name: z.string().min(1, 'Rule name is required').max(100, 'Name cannot exceed 100 characters'),
  weekday: z.number().int().min(0).max(6), // 0-6 (0 = Sunday)
  n: z.number().int().min(1).max(5), // 1-5 (e.g., 4 = "every 4th")
});

/**
 * Shift block configuration for custom rotation algorithm
 */
export const ShiftBlockConfigSchema = z.object({
  shiftBlockLength: z.number().int().min(1).max(14), // Days per shift block (max 14)
  freeDays: z.number().int().min(0).max(14), // Free days between shifts
  startShift: ShiftBlockTypeSchema,
  shiftSequence: z.array(ShiftBlockTypeSchema).length(3), // Must be exactly 3 shifts
  specialRules: z.array(NthWeekdayFreeRuleSchema).optional(),
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List shifts query parameters
 */
export const ListShiftsQuerySchema = PaginationSchema.extend({
  date: ShiftDateSchema.optional(),
  startDate: ShiftDateSchema.optional(),
  endDate: ShiftDateSchema.optional(),
  userId: IdSchema.optional(),
  departmentId: IdSchema.optional(),
  teamId: IdSchema.optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  templateId: IdSchema.optional(),
  planId: IdSchema.optional(),
  sortBy: SortBySchema.optional(),
  sortOrder: SortOrderSchema.optional(),
});

/**
 * List swap requests query parameters
 */
export const ListSwapRequestsQuerySchema = z.object({
  userId: IdSchema.optional(),
  status: SwapRequestStatusSchema.optional(),
});

/**
 * Get overtime report query parameters
 */
export const GetOvertimeReportQuerySchema = z.object({
  userId: IdSchema.optional(),
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
});

/**
 * Export shifts query parameters
 */
export const ExportShiftsQuerySchema = z.object({
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  departmentId: IdSchema.optional(),
  teamId: IdSchema.optional(),
  userId: IdSchema.optional(),
  format: z.enum(['csv', 'excel']).optional(),
});

/**
 * Upcoming maintenance query parameters
 */
export const UpcomingMaintenanceQuerySchema = z.object({
  days: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' || typeof val === 'number' ?
        Number.parseInt(val.toString(), 10)
      : val,
    z.number().int().min(1).max(365).optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Shift ID parameter validation
 */
export const ShiftIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Template ID parameter validation
 */
export const TemplateIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Swap request ID parameter validation
 */
export const SwapRequestIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Favorite ID parameter validation
 */
export const FavoriteIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create shift request body
 */
export const CreateShiftBodySchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  date: ShiftDateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
  departmentId: z.number().int().positive('Department ID is required'),
  planId: IdSchema.optional(),
  templateId: IdSchema.optional(),
  title: z.string().trim().max(200, 'Title cannot exceed 200 characters').optional(),
  requiredEmployees: z
    .number()
    .int()
    .positive('Required employees must be a positive integer')
    .optional(),
  breakMinutes: z.number().int().min(0, 'Break minutes must be a non-negative integer').optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  teamId: IdSchema.optional(),
});

/**
 * Update shift request body (all fields optional)
 */
export const UpdateShiftBodySchema = z.object({
  userId: IdSchema.optional(),
  date: ShiftDateSchema.optional(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  actualStart: TimeWithSecondsSchema.optional(),
  actualEnd: TimeWithSecondsSchema.optional(),
  departmentId: IdSchema.optional(),
  planId: IdSchema.optional(),
  templateId: IdSchema.optional(),
  title: z.string().trim().max(200, 'Title cannot exceed 200 characters').optional(),
  requiredEmployees: z
    .number()
    .int()
    .positive('Required employees must be a positive integer')
    .optional(),
  breakMinutes: z.number().int().min(0, 'Break minutes must be a non-negative integer').optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  teamId: IdSchema.optional(),
});

/**
 * Create template request body
 */
export const CreateTemplateBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Template name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  startTime: TimeSchema,
  endTime: TimeSchema,
  breakMinutes: z.number().int().min(0, 'Break minutes must be a non-negative integer').optional(),
  color: HexColorSchema.optional(),
  isNightShift: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Update template request body (all fields optional)
 */
export const UpdateTemplateBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Template name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  breakMinutes: z.number().int().min(0, 'Break minutes must be a non-negative integer').optional(),
  color: HexColorSchema.optional(),
  isNightShift: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Create swap request body
 */
export const CreateSwapRequestBodySchema = z.object({
  shiftId: z.number().int().positive('Shift ID is required'),
  requestedWithUserId: z
    .number()
    .int()
    .positive('Requested with user ID must be a positive integer')
    .optional(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

/**
 * Update swap request status body
 */
export const UpdateSwapRequestStatusBodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled'], {
    message: 'Status must be approved, rejected, or cancelled',
  }),
});

/**
 * Create favorite request body
 */
export const CreateFavoriteBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  areaId: z.number().int().positive('Area ID is required'),
  areaName: z.string().trim().min(1, 'Area name is required'),
  departmentId: z.number().int().positive('Department ID is required'),
  departmentName: z.string().trim().min(1, 'Department name is required'),
  machineId: z.number().int().positive('Machine ID is required'),
  machineName: z.string().trim().min(1, 'Machine name is required'),
  teamId: z.number().int().positive('Team ID is required'),
  teamName: z.string().trim().min(1, 'Team name is required'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListShiftsQuery = z.infer<typeof ListShiftsQuerySchema>;
export type ListSwapRequestsQuery = z.infer<typeof ListSwapRequestsQuerySchema>;
export type GetOvertimeReportQuery = z.infer<typeof GetOvertimeReportQuerySchema>;
export type ExportShiftsQuery = z.infer<typeof ExportShiftsQuerySchema>;
export type UpcomingMaintenanceQuery = z.infer<typeof UpcomingMaintenanceQuerySchema>;
export type ShiftIdParam = z.infer<typeof ShiftIdParamSchema>;
export type TemplateIdParam = z.infer<typeof TemplateIdParamSchema>;
export type SwapRequestIdParam = z.infer<typeof SwapRequestIdParamSchema>;
export type FavoriteIdParam = z.infer<typeof FavoriteIdParamSchema>;
export type CreateShiftBody = z.infer<typeof CreateShiftBodySchema>;
export type UpdateShiftBody = z.infer<typeof UpdateShiftBodySchema>;
export type CreateTemplateBody = z.infer<typeof CreateTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof UpdateTemplateBodySchema>;
export type CreateSwapRequestBody = z.infer<typeof CreateSwapRequestBodySchema>;
export type UpdateSwapRequestStatusBody = z.infer<typeof UpdateSwapRequestStatusBodySchema>;
export type CreateFavoriteBody = z.infer<typeof CreateFavoriteBodySchema>;
export type ShiftBlockType = z.infer<typeof ShiftBlockTypeSchema>;
export type NthWeekdayFreeRule = z.infer<typeof NthWeekdayFreeRuleSchema>;
export type ShiftBlockConfig = z.infer<typeof ShiftBlockConfigSchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for shift routes
 */
export const shiftsValidationZod = {
  // Shifts CRUD
  listShifts: validateQuery(ListShiftsQuerySchema),
  getShiftById: validateParams(ShiftIdParamSchema),
  createShift: validateBody(CreateShiftBodySchema),
  updateShift: [validateParams(ShiftIdParamSchema), validateBody(UpdateShiftBodySchema)],
  deleteShift: validateParams(ShiftIdParamSchema),

  // Templates
  getTemplateById: validateParams(TemplateIdParamSchema),
  createTemplate: validateBody(CreateTemplateBodySchema),
  updateTemplate: [validateParams(TemplateIdParamSchema), validateBody(UpdateTemplateBodySchema)],
  deleteTemplate: validateParams(TemplateIdParamSchema),

  // Swap Requests
  listSwapRequests: validateQuery(ListSwapRequestsQuerySchema),
  createSwapRequest: validateBody(CreateSwapRequestBodySchema),
  updateSwapRequestStatus: [
    validateParams(SwapRequestIdParamSchema),
    validateBody(UpdateSwapRequestStatusBodySchema),
  ],

  // Overtime
  getOvertimeReport: validateQuery(GetOvertimeReportQuerySchema),

  // Favorites
  createFavorite: validateBody(CreateFavoriteBodySchema),
  deleteFavorite: validateParams(FavoriteIdParamSchema),

  // Export
  exportShifts: validateQuery(ExportShiftsQuerySchema),

  // Maintenance
  upcomingMaintenance: validateQuery(UpcomingMaintenanceQuerySchema),
};
