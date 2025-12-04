/**
 * Areas API v2 Validation with Zod
 * Replaces express-validator with Zod for area endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Area type enum
 */
const AreaTypeSchema = z.enum(
  ['building', 'warehouse', 'office', 'production', 'outdoor', 'other'],
  {
    message: 'Type must be one of: building, warehouse, office, production, outdoor, other',
  },
);

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get areas query parameters
 * UPDATED: isActive now integer status (2025-12-02)
 */
export const GetAreasQuerySchema = z.object({
  type: AreaTypeSchema.optional(),
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  isActive: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(0).max(4).optional(),
  ),
  // NOTE: parentId removed (2025-11-29) - areas are now flat (non-hierarchical)
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be at least 1 character')
    .max(100, 'Search term must not exceed 100 characters')
    .optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Area ID parameter validation
 */
export const AreaIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create area request body
 */
export const CreateAreaBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Area name must be at least 2 characters')
    .max(255, 'Area name must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
  areaLeadId: z.coerce
    .number()
    .int()
    .positive('Area lead ID must be a positive integer')
    .nullable()
    .optional(),
  type: AreaTypeSchema.default('other'),
  capacity: z.coerce
    .number()
    .int()
    .nonnegative('Capacity must be a non-negative integer')
    .nullable()
    .optional(),
  // NOTE: parentId removed (2025-11-29) - areas are now flat (non-hierarchical)
  address: z.string().trim().max(500, 'Address must not exceed 500 characters').optional(),
});

/**
 * Update area request body (all fields optional)
 * UPDATED: isArchived removed, using isActive status (2025-12-02)
 */
export const UpdateAreaBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Area name must be at least 2 characters')
    .max(255, 'Area name must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
  areaLeadId: z.coerce
    .number()
    .int()
    .positive('Area lead ID must be a positive integer')
    .nullable()
    .optional(),
  type: AreaTypeSchema.optional(),
  capacity: z.coerce
    .number()
    .int()
    .nonnegative('Capacity must be a non-negative integer')
    .nullable()
    .optional(),
  // NOTE: parentId removed (2025-11-29) - areas are now flat (non-hierarchical)
  address: z.string().trim().max(500, 'Address must not exceed 500 characters').optional(),
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted (coerce for string input from forms)
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GetAreasQuery = z.infer<typeof GetAreasQuerySchema>;
export type AreaIdParam = z.infer<typeof AreaIdParamSchema>;
export type CreateAreaBody = z.infer<typeof CreateAreaBodySchema>;
export type UpdateAreaBody = z.infer<typeof UpdateAreaBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for area routes
 */
export const areasValidationZod = {
  list: validateQuery(GetAreasQuerySchema),
  getById: validateParams(AreaIdParamSchema),
  create: validateBody(CreateAreaBodySchema),
  update: [validateParams(AreaIdParamSchema), validateBody(UpdateAreaBodySchema)],
  delete: validateParams(AreaIdParamSchema),
};
