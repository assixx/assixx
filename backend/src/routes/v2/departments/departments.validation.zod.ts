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
 * Coerce various input types to boolean
 * Accepts: 'true', 'false', '1', '0', 1, 0, true, false
 * @param val - Unknown input value
 * @returns Boolean or original value if not coercible
 */
function coerceToBooleanOrPassthrough(val: unknown): unknown {
  // String values
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;

  // Number values
  if (val === 1) return true;
  if (val === 0) return false;

  // Already boolean or other type - pass through
  return val;
}

/**
 * Boolean coercion for isActive (accepts 1/0 strings from forms)
 */
const BooleanCoercion = z.preprocess(coerceToBooleanOrPassthrough, z.boolean());

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get departments query parameters
 */
export const GetDepartmentsQuerySchema = z.object({
  includeExtended: z.preprocess(coerceToBooleanOrPassthrough, z.boolean().optional()),
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
  departmentLeadId: z
    .number()
    .int()
    .positive('Department lead ID must be a positive integer')
    .nullable()
    .optional(),
  areaId: z.number().int().positive('Area ID must be a positive integer').nullable().optional(),
  isActive: BooleanCoercion.optional(),
  isArchived: BooleanCoercion.optional(),
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
  departmentLeadId: z
    .number()
    .int()
    .positive('Department lead ID must be a positive integer')
    .nullable()
    .optional(),
  areaId: z.number().int().positive('Area ID must be a positive integer').nullable().optional(),
  isActive: BooleanCoercion.optional(),
  isArchived: BooleanCoercion.optional(),
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
