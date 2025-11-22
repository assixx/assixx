/**
 * Calendar API v2 Validation with Zod
 * Centralized validation schemas for calendar event endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Organization level enum for event visibility
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team', 'area', 'personal'], {
  message: 'Valid organization level is required',
});

/**
 * Event status enum
 */
const EventStatusSchema = z.enum(['active', 'cancelled'], {
  message: 'Valid event status is required',
});

/**
 * Event status for updates (includes tentative, confirmed)
 */
const UpdateEventStatusSchema = z.enum(['tentative', 'confirmed', 'cancelled'], {
  message: 'Valid event status is required',
});

/**
 * Sort by field enum
 */
const SortBySchema = z.enum(['startDate', 'endDate', 'title', 'createdAt'], {
  message: 'Valid sort field is required',
});

/**
 * Sort order enum
 */
const SortOrderSchema = z.enum(['asc', 'desc'], {
  message: 'Valid sort order is required',
});

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['ics', 'csv'], {
  message: 'Valid format is required (ics or csv)',
});

/**
 * Hex color validation
 */
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
  .optional();

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create event request body
 * NOTE: Uses z.iso.datetime() which requires strict ISO 8601 UTC format with Z suffix
 * Example: "2025-11-27T00:00:00Z"
 */
export const CreateEventBodySchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    startTime: z.iso.datetime({ message: 'Valid start time is required' }),
    endTime: z.iso.datetime({ message: 'Valid end time is required' }),
    allDay: z.boolean().optional(),
    orgLevel: OrgLevelSchema,
    orgId: IdSchema.optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    reminderMinutes: z.number().int().min(0).optional(),
    color: HexColorSchema,
    recurrenceRule: z.string().optional(),
    attendeeIds: z.array(IdSchema).optional(),
  })
  .refine(
    (data: { endTime: string; startTime: string }) =>
      new Date(data.endTime) > new Date(data.startTime),
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    },
  )
  .refine(
    (data: { orgLevel: string; orgId?: number }) => {
      if (data.orgLevel === 'department' || data.orgLevel === 'team' || data.orgLevel === 'area') {
        return data.orgId !== undefined;
      }
      return true;
    },
    {
      message: 'Organization ID is required for department/team/area events',
      path: ['orgId'],
    },
  );

/**
 * Update event request body (all fields optional)
 */
export const UpdateEventBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    startTime: z.iso.datetime().optional(),
    endTime: z.iso.datetime().optional(),
    allDay: z.boolean().optional(),
    orgLevel: OrgLevelSchema.optional(),
    orgId: IdSchema.optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    reminderMinutes: z.number().int().min(0).optional(),
    color: HexColorSchema,
    recurrenceRule: z.string().optional(),
    status: UpdateEventStatusSchema.optional(),
  })
  .refine(
    (data: { startTime?: string; endTime?: string }) => {
      if (data.startTime !== undefined && data.endTime !== undefined) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    },
  );

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List events query parameters
 */
export const ListEventsQuerySchema = z.object({
  status: EventStatusSchema.optional(),
  filter: z.enum(['all', 'company', 'department', 'team', 'area', 'personal']).optional(),
  search: z.string().optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: SortBySchema.optional(),
  sortOrder: SortOrderSchema.optional(),
});

/**
 * Export events query parameters
 */
export const ExportEventsQuerySchema = z.object({
  format: ExportFormatSchema,
});

/**
 * Dashboard events query parameters
 */
export const DashboardEventsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Event ID parameter validation
 */
export const EventIdParamSchema = z.object({
  id: z.coerce.number().int().min(1, 'Valid event ID is required'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type CreateEventBody = z.infer<typeof CreateEventBodySchema>;
export type UpdateEventBody = z.infer<typeof UpdateEventBodySchema>;
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;
export type ExportEventsQuery = z.infer<typeof ExportEventsQuerySchema>;
export type DashboardEventsQuery = z.infer<typeof DashboardEventsQuerySchema>;
export type EventIdParam = z.infer<typeof EventIdParamSchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for calendar routes
 */
export const calendarValidationZod = {
  list: validateQuery(ListEventsQuerySchema),
  getById: validateParams(EventIdParamSchema),
  create: validateBody(CreateEventBodySchema),
  update: [validateParams(EventIdParamSchema), validateBody(UpdateEventBodySchema)],
  delete: validateParams(EventIdParamSchema),
  export: validateQuery(ExportEventsQuerySchema),
  dashboard: validateQuery(DashboardEventsQuerySchema),
  unreadEvents: [], // No validation needed
};
