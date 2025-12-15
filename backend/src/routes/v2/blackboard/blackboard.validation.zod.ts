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
const FilterSchema = z.enum(['all', 'company', 'department', 'team', 'area'], {
  message: 'Filter must be one of: all, company, department, team, area',
});

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team', 'area'], {
  message: 'Organization level must be company, department, team, or area',
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
 * UUID v4/v7 validation
 * Matches: 8-4-4-4-12 hex characters (case insensitive)
 */
const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format');

/**
 * ID or UUID parameter validation
 * Supports both numeric IDs (legacy) and UUIDv7 (new secure URLs)
 * CRITICAL: Must check UUID pattern BEFORE parseInt to avoid truncating UUIDs starting with digits
 * Example: "019ab813-cbc3-724e-a263-68c9c8290805" would become 19 if parseInt runs first!
 */
const IdOrUuidSchema = z.string().transform((val: string) => {
  // Check if it's a UUID first (CRITICAL: must be checked before parseInt!)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(val)) {
    return val; // Return UUID as string
  }

  // Try to parse as number (legacy numeric ID)
  const numericId = Number.parseInt(val, 10);
  if (Number.isNaN(numericId) || numericId <= 0) {
    throw new Error('ID must be a positive integer or valid UUID');
  }
  return numericId;
});

/**
 * Entry ID parameter validation
 * NEW: Accepts both numeric ID and UUID for transition period
 */
export const EntryIdParamSchema = z.object({
  id: IdOrUuidSchema,
});

/**
 * Attachment ID parameter validation
 */
export const AttachmentIdParamSchema = z.object({
  attachmentId: IdSchema,
});

/**
 * File UUID parameter validation for secure attachment downloads
 * NEW 2025-11-26: Matches KVP pattern for consistent API
 */
export const FileUuidParamSchema = z.object({
  fileUuid: UuidSchema,
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
  // Multi-organization support - arrays of IDs
  departmentIds: z.array(z.number().int().positive()).optional().default([]),
  teamIds: z.array(z.number().int().positive()).optional().default([]),
  areaIds: z.array(z.number().int().positive()).optional().default([]),
  // Legacy fields (keep for backwards compatibility)
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
  // Multi-organization support - arrays of IDs
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  areaIds: z.array(z.number().int().positive()).optional(),
  // Legacy fields (keep for backwards compatibility)
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
});

// ============================================================
// COMMENT SCHEMAS (NEW 2025-11-24)
// ============================================================

/**
 * Comment ID parameter validation
 */
export const CommentIdParamSchema = z.object({
  commentId: IdSchema,
});

/**
 * Add comment request body
 */
export const AddCommentBodySchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Comment is required')
    .max(5000, 'Comment must not exceed 5000 characters'),
  isInternal: z.boolean().optional().default(false),
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
export type CommentIdParam = z.infer<typeof CommentIdParamSchema>;
export type AddCommentBody = z.infer<typeof AddCommentBodySchema>;

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
  confirmationStatus: validateParams(EntryIdParamSchema),
  dashboard: validateQuery(DashboardQuerySchema),
  uploadAttachment: validateParams(EntryIdParamSchema),
  getAttachments: validateParams(EntryIdParamSchema),
  deleteAttachment: validateParams(AttachmentIdParamSchema),
  downloadAttachment: validateParams(AttachmentIdParamSchema),
  downloadByFileUuid: validateParams(FileUuidParamSchema), // NEW 2025-11-26: Like KVP
  // Comment validation (NEW 2025-11-24)
  getComments: validateParams(EntryIdParamSchema),
  addComment: [validateParams(EntryIdParamSchema), validateBody(AddCommentBodySchema)],
  deleteComment: validateParams(CommentIdParamSchema),
};
