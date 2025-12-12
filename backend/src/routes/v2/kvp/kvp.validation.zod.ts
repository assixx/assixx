/**
 * KVP API v2 Validation with Zod
 * Replaces express-validator with Zod for Continuous Improvement Process endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * KVP suggestion status enum
 */
const StatusSchema = z.enum(
  ['new', 'in_review', 'approved', 'implemented', 'rejected', 'archived'],
  {
    message: 'Invalid status value',
  },
);

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Invalid priority value',
});

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'area', 'team'], {
  message: 'Invalid organization level',
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List suggestions query parameters
 */
export const ListSuggestionsQuerySchema = PaginationSchema.extend({
  status: StatusSchema.optional(),
  categoryId: IdSchema.optional(),
  priority: PrioritySchema.optional(),
  orgLevel: OrgLevelSchema.optional(),
  search: z.string().trim().max(100, 'Search query too long').optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * UUID v4/v7 format validation
 * Matches: 8-4-4-4-12 hex characters (case insensitive)
 */
const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format');

/**
 * ID or UUID schema - accepts both numeric ID and UUID string
 * Used for dual-ID transition period (backwards compatibility)
 * IMPORTANT: Must check UUID pattern BEFORE parseInt to avoid truncating UUIDs starting with digits
 */
const IdOrUuidSchema = z
  .string()
  .transform((val: string) => {
    // Check if it's a UUID first (CRITICAL: must be checked before parseInt!)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(val)) {
      return val; // Return UUID as string
    }

    // Try to parse as number (legacy numeric ID)
    const numericId = Number.parseInt(val, 10);
    if (!Number.isNaN(numericId) && numericId > 0 && val === String(numericId)) {
      return numericId; // Return number for numeric IDs
    }

    // Neither valid UUID nor valid number - return original for error handling
    return val;
  })
  .refine(
    (val: string | number) => {
      // Valid if it's a positive number
      if (typeof val === 'number') {
        return val > 0;
      }
      // Valid if it's a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(val);
    },
    {
      message: 'Must be either a valid UUID or a positive integer ID',
    },
  );

/**
 * Suggestion ID parameter validation
 * NEW: Accepts both numeric ID and UUID for transition period
 */
export const SuggestionIdParamSchema = z.object({
  id: IdOrUuidSchema,
});

/**
 * User ID parameter validation (optional)
 */
export const UserIdParamSchema = z.object({
  userId: IdSchema.optional(),
});

/**
 * Attachment ID parameter validation
 */
export const AttachmentIdParamSchema = z.object({
  attachmentId: IdSchema,
});

/**
 * File UUID parameter validation for secure attachment downloads
 */
export const FileUuidParamSchema = z.object({
  fileUuid: UuidSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create suggestion request body
 */
export const CreateSuggestionBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
  categoryId: IdSchema,
  departmentId: IdSchema.optional().nullable(),
  orgLevel: OrgLevelSchema,
  orgId: z.number().int().min(0, 'Organization ID must be a non-negative integer'),
  priority: PrioritySchema.optional(),
  expectedBenefit: z
    .string()
    .trim()
    .max(500, 'Expected benefit cannot exceed 500 characters')
    .optional(),
  estimatedCost: z
    .string()
    .trim()
    .max(100, 'Estimated cost cannot exceed 100 characters')
    .optional(),
});

/**
 * Update suggestion request body (all fields optional)
 */
export const UpdateSuggestionBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters')
    .optional(),
  categoryId: IdSchema.optional(),
  priority: PrioritySchema.optional(),
  expectedBenefit: z
    .string()
    .trim()
    .max(500, 'Expected benefit cannot exceed 500 characters')
    .optional(),
  estimatedCost: z
    .string()
    .trim()
    .max(100, 'Estimated cost cannot exceed 100 characters')
    .optional(),
  actualSavings: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseFloat(val) : val),
    z.number().min(0, 'Actual savings must be a non-negative number').optional(),
  ),
  status: StatusSchema.optional(),
  assignedTo: IdSchema.optional(),
  rejectionReason: z
    .string()
    .trim()
    .max(500, 'Rejection reason cannot exceed 500 characters')
    .optional(),
});

/**
 * Add comment request body
 */
export const AddCommentBodySchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must not exceed 2000 characters'),
  isInternal: z.boolean().optional(),
});

/**
 * Share suggestion request body
 */
export const ShareSuggestionBodySchema = z.object({
  orgLevel: OrgLevelSchema,
  orgId: z.number().int().min(0, 'Organization ID must be a non-negative integer'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListSuggestionsQuery = z.infer<typeof ListSuggestionsQuerySchema>;
export type SuggestionIdParam = z.infer<typeof SuggestionIdParamSchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
export type AttachmentIdParam = z.infer<typeof AttachmentIdParamSchema>;
export type FileUuidParam = z.infer<typeof FileUuidParamSchema>;
export type CreateSuggestionBody = z.infer<typeof CreateSuggestionBodySchema>;
export type UpdateSuggestionBody = z.infer<typeof UpdateSuggestionBodySchema>;
export type AddCommentBody = z.infer<typeof AddCommentBodySchema>;
export type ShareSuggestionBody = z.infer<typeof ShareSuggestionBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for KVP routes
 */
export const kvpValidationZod = {
  list: validateQuery(ListSuggestionsQuerySchema),
  getById: validateParams(SuggestionIdParamSchema),
  create: validateBody(CreateSuggestionBodySchema),
  update: [validateParams(SuggestionIdParamSchema), validateBody(UpdateSuggestionBodySchema)],
  delete: validateParams(SuggestionIdParamSchema),
  addComment: [validateParams(SuggestionIdParamSchema), validateBody(AddCommentBodySchema)],
  attachmentId: validateParams(AttachmentIdParamSchema),
  fileUuid: validateParams(FileUuidParamSchema),
  share: [validateParams(SuggestionIdParamSchema), validateBody(ShareSuggestionBodySchema)],
};
