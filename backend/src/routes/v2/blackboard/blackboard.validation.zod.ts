/**
 * Blackboard API v2 Validation with Zod
 * Replaces express-validator with Zod for blackboard endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Blackboard entry status enum
 */
const EntryStatusSchema = z.enum(['active', 'archived'], {
  message: "Status must be 'active' or 'archived'",
});

/**
 * Filter type enum
 */
const FilterSchema = z.enum(['all', 'company', 'department', 'team'], {
  message: 'Filter must be one of: all, company, department, team',
});

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team'], {
  message: 'Organization level must be company, department, or team',
});

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  message: 'Invalid priority value',
});

/**
 * Sort field enum
 */
const SortBySchema = z.enum(['created_at', 'updated_at', 'title', 'priority', 'expires_at'], {
  message: 'Invalid sort field',
});

/**
 * Sort direction enum
 */
const SortDirSchema = z.enum(['ASC', 'DESC'], {
  message: 'Sort direction must be ASC or DESC',
});

/**
 * Tags array validation
 */
const TagsSchema = z.array(z.string().max(50, 'Each tag must not exceed 50 characters')).optional();

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List blackboard entries query parameters
 */
export const ListEntriesQuerySchema = PaginationSchema.extend({
  status: EntryStatusSchema.optional(),
  filter: FilterSchema.optional(),
  search: z.string().trim().max(100, 'Search term cannot exceed 100 characters').optional(),
  sortBy: SortBySchema.optional(),
  sortDir: SortDirSchema.optional(),
  priority: PrioritySchema.optional(),
  requiresConfirmation: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

/**
 * Dashboard entries query parameters
 */
export const DashboardQuerySchema = z.object({
  limit: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(1).max(10, 'Limit must be between 1 and 10').optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Entry ID parameter validation
 */
export const EntryIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Attachment ID parameter validation
 */
export const AttachmentIdParamSchema = z.object({
  attachmentId: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create blackboard entry request body
 */
export const CreateEntryBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters'),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(5000, 'Content must not exceed 5000 characters'),
  orgLevel: OrgLevelSchema,
  orgId: z
    .number()
    .int()
    .positive('Organization ID must be a positive integer')
    .nullable()
    .optional(),
  expiresAt: DateSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  color: z.string().trim().max(50, 'Color cannot exceed 50 characters').optional(),
  requiresConfirmation: z.boolean().optional(),
  tags: TagsSchema,
});

/**
 * Update blackboard entry request body (all fields optional)
 */
export const UpdateEntryBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content must not exceed 5000 characters')
    .optional(),
  orgLevel: OrgLevelSchema.optional(),
  orgId: z
    .number()
    .int()
    .positive('Organization ID must be a positive integer')
    .nullable()
    .optional(),
  expiresAt: DateSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  color: z.string().trim().max(50, 'Color cannot exceed 50 characters').optional(),
  status: EntryStatusSchema.optional(),
  requiresConfirmation: z.boolean().optional(),
  tags: TagsSchema,
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListEntriesQuery = z.infer<typeof ListEntriesQuerySchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type EntryIdParam = z.infer<typeof EntryIdParamSchema>;
export type AttachmentIdParam = z.infer<typeof AttachmentIdParamSchema>;
export type CreateEntryBody = z.infer<typeof CreateEntryBodySchema>;
export type UpdateEntryBody = z.infer<typeof UpdateEntryBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for blackboard routes
 */
export const blackboardValidationZod = {
  list: validateQuery(ListEntriesQuerySchema),
  getById: validateParams(EntryIdParamSchema),
  create: validateBody(CreateEntryBodySchema),
  update: [validateParams(EntryIdParamSchema), validateBody(UpdateEntryBodySchema)],
  delete: validateParams(EntryIdParamSchema),
  archiveUnarchive: validateParams(EntryIdParamSchema),
  confirm: validateParams(EntryIdParamSchema),
  dashboard: validateQuery(DashboardQuerySchema),
  uploadAttachment: validateParams(EntryIdParamSchema),
  getAttachments: validateParams(EntryIdParamSchema),
  deleteAttachment: validateParams(AttachmentIdParamSchema),
  downloadAttachment: validateParams(AttachmentIdParamSchema),
};
