/**
 * Departments API v2 Validation with Zod
 * Replaces express-validator with Zod for department endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Department visibility enum
 */
const VisibilitySchema = z.enum(['public', 'private'], {
  message: "Visibility must be either 'public' or 'private'",
});

/**
 * Department status enum
 */
const StatusSchema = z.enum(['active', 'inactive'], {
  message: "Status must be either 'active' or 'inactive'",
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get departments query parameters
 */
export const GetDepartmentsQuerySchema = z.object({
  includeExtended: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Department ID parameter validation
 */
export const DepartmentIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create department request body
 */
export const CreateDepartmentBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(100, 'Department name must not exceed 100 characters'),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional(),
  managerId: z
    .number()
    .int()
    .positive('Manager ID must be a positive integer')
    .nullable()
    .optional(),
  areaId: z.number().int().positive('Area ID must be a positive integer').nullable().optional(),
  status: StatusSchema.optional(),
  visibility: VisibilitySchema.optional(),
});

/**
 * Update department request body (all fields optional)
 */
export const UpdateDepartmentBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(100, 'Department name must not exceed 100 characters')
    .optional(),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional(),
  managerId: z
    .number()
    .int()
    .positive('Manager ID must be a positive integer')
    .nullable()
    .optional(),
  areaId: z.number().int().positive('Area ID must be a positive integer').nullable().optional(),
  status: StatusSchema.optional(),
  visibility: VisibilitySchema.optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GetDepartmentsQuery = z.infer<typeof GetDepartmentsQuerySchema>;
export type DepartmentIdParam = z.infer<typeof DepartmentIdParamSchema>;
export type CreateDepartmentBody = z.infer<typeof CreateDepartmentBodySchema>;
export type UpdateDepartmentBody = z.infer<typeof UpdateDepartmentBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for department routes
 */
export const departmentsValidationZod = {
  list: validateQuery(GetDepartmentsQuerySchema),
  getById: validateParams(DepartmentIdParamSchema),
  create: validateBody(CreateDepartmentBodySchema),
  update: [validateParams(DepartmentIdParamSchema), validateBody(UpdateDepartmentBodySchema)],
  delete: validateParams(DepartmentIdParamSchema),
};
