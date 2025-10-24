/**
 * KVP API v2 Validation with Zod
 * Replaces express-validator with Zod for Continuous Improvement Process endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { IdSchema, PaginationSchema } from '../../../schemas/common.schema';

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
const OrgLevelSchema = z.enum(['company', 'department', 'team'], {
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
 * Suggestion ID parameter validation
 */
export const SuggestionIdParamSchema = z.object({
  id: IdSchema,
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
    (val) => (typeof val === 'string' ? Number.parseFloat(val) : val),
    z.number().min(0, 'Actual savings must be a non-negative number').optional(),
  ),
  status: StatusSchema.optional(),
  assignedTo: IdSchema.optional(),
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
 * Award points request body
 */
export const AwardPointsBodySchema = z.object({
  userId: IdSchema,
  suggestionId: IdSchema,
  points: z
    .number()
    .int()
    .min(1, 'Points must be at least 1')
    .max(1000, 'Points must not exceed 1000'),
  reason: z
    .string()
    .trim()
    .min(3, 'Reason must be at least 3 characters')
    .max(500, 'Reason must not exceed 500 characters'),
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
export type CreateSuggestionBody = z.infer<typeof CreateSuggestionBodySchema>;
export type UpdateSuggestionBody = z.infer<typeof UpdateSuggestionBodySchema>;
export type AddCommentBody = z.infer<typeof AddCommentBodySchema>;
export type AwardPointsBody = z.infer<typeof AwardPointsBodySchema>;
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
  awardPoints: validateBody(AwardPointsBodySchema),
  getUserPoints: validateParams(UserIdParamSchema),
  attachmentId: validateParams(AttachmentIdParamSchema),
  share: [validateParams(SuggestionIdParamSchema), validateBody(ShareSuggestionBodySchema)],
};
