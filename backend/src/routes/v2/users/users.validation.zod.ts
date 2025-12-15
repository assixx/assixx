/**
 * Users API v2 Validation with Zod
 * Demonstrates migration from express-validator to Zod
 *
 * Benefits over express-validator:
 * 1. Type inference - automatic TypeScript types
 * 2. Better composition and reusability
 * 3. Transforms built-in (string to number)
 * 4. More readable schema definitions
 * 5. Better error messages
 */
import { z } from 'zod';

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import {
  EmailSchema,
  IdSchema,
  PaginationSchema,
  PasswordSchema,
  RoleSchema,
} from '../../../schemas/common.schema.js';

// CUSTOM VALIDATORS

/**
 * Phone number validation
 * Matches the existing isValidPhoneNumber logic
 */
const PhoneSchema = z
  .string()
  .regex(
    /^\+[0-9]{7,29}$/,
    'Invalid phone number format (must start with + and contain 7-29 digits)',
  )
  .nullable()
  .optional();

/**
 * Employee number validation
 */
const EmployeeNumberSchema = z
  .string()
  .regex(/^[-0-9A-Za-z]{1,10}$/, 'Employee number: max 10 characters (letters, numbers, hyphen)')
  .optional();

/**
 * Availability status enum
 */
const AvailabilityStatusSchema = z.enum(['available', 'vacation', 'sick', 'training', 'other'], {
  message: 'Invalid availability status',
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List users query parameters
 * Extends base pagination with user-specific filters
 * UPDATED: isArchived removed, using isActive status (2025-12-02)
 */
export const UsersListQuerySchema = PaginationSchema.extend({
  search: z.string().trim().optional(),
  role: RoleSchema.optional(),
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  isActive: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(0).max(4).optional(),
  ),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * User ID parameter validation
 */
export const UserIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create user request body
 * N:M REFACTORING: Added departmentIds, teamIds, hasFullAccess
 */
export const CreateUserBodySchema = z.object({
  email: EmailSchema,
  firstName: z.string().trim().min(1, 'First name required'),
  lastName: z.string().trim().min(1, 'Last name required'),
  password: PasswordSchema,
  role: z.enum(['employee', 'admin']).default('employee'),
  // N:M REFACTORING: Legacy field (deprecated)
  departmentId: z.number().int().positive().nullable().optional(),
  // N:M REFACTORING: New array fields for multiple assignments
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  hasFullAccess: z.boolean().optional(),
  position: z.string().trim().optional(),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  employeeNumber: EmployeeNumberSchema,
});

/**
 * Update user request body (all fields optional)
 * N:M REFACTORING: Added departmentIds, teamIds, hasFullAccess
 */
export const UpdateUserBodySchema = z.object({
  email: EmailSchema.optional(),
  firstName: z.string().trim().min(1, 'First name cannot be empty').optional(),
  lastName: z.string().trim().min(1, 'Last name cannot be empty').optional(),
  password: PasswordSchema.optional(), // Allow password updates
  role: z.enum(['employee', 'admin']).optional(),
  // N:M REFACTORING: Legacy field (deprecated)
  departmentId: z.number().int().positive().nullable().optional(),
  // N:M REFACTORING: New array fields for multiple assignments
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  hasFullAccess: z.boolean().optional(),
  position: z.string().trim().optional(),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  employeeNumber: EmployeeNumberSchema,
  dateOfBirth: z.string().trim().optional(),
  // Availability fields for employee status tracking
  availabilityStatus: AvailabilityStatusSchema.optional(),
  availabilityStart: z.string().nullable().optional(), // Date string YYYY-MM-DD or null
  availabilityEnd: z.string().nullable().optional(), // Date string YYYY-MM-DD or null
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Update profile request body (limited fields for self-update)
 */
export const UpdateProfileBodySchema = z.object({
  firstName: z.string().trim().min(1, 'First name cannot be empty').optional(),
  lastName: z.string().trim().min(1, 'Last name cannot be empty').optional(),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: PhoneSchema,
  employeeNumber: EmployeeNumberSchema,
});

/**
 * Change password request body with validation
 */
export const ChangePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine(
    (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      data.newPassword !== data.currentPassword,
    {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    },
  )
  .refine(
    (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    },
  );

/**
 * Update availability request body
 */
export const UpdateAvailabilityBodySchema = z.object({
  availabilityStatus: AvailabilityStatusSchema,
  availabilityStart: z
    .string()
    .refine(
      (val: string) => {
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return isoDatePattern.test(val);
      },
      { message: 'Invalid datetime format' },
    )
    .optional(),
  availabilityEnd: z
    .string()
    .refine(
      (val: string) => {
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return isoDatePattern.test(val);
      },
      { message: 'Invalid datetime format' },
    )
    .optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

// Automatic type inference from schemas
export type UsersListQuery = z.infer<typeof UsersListQuerySchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
export type UpdateAvailabilityBody = z.infer<typeof UpdateAvailabilityBodySchema>;

// ============================================================

// ============================================================

/**
 * Pre-configured validation middleware for user routes
 * Can be used directly in route definitions
 */
export const usersValidationZod = {
  // List users validation
  list: validateQuery(UsersListQuerySchema),

  // Get user by ID
  getById: validateParams(UserIdParamSchema),

  // Create user validation
  create: validateBody(CreateUserBodySchema),

  // Update user validation (params + body)
  update: [validateParams(UserIdParamSchema), validateBody(UpdateUserBodySchema)],

  // Update profile validation
  updateProfile: validateBody(UpdateProfileBodySchema),

  // Change password validation
  changePassword: validateBody(ChangePasswordBodySchema),

  // Update availability validation
  updateAvailability: [
    validateParams(UserIdParamSchema),
    validateBody(UpdateAvailabilityBodySchema),
  ],

  // Archive/Unarchive validation
  archive: validateParams(UserIdParamSchema),
};

// ============================================================
// MIGRATION HELPER
// ============================================================

/**
 * Helper to show how to migrate from express-validator
 *
 * Old way with express-validator:
 * ```typescript
 * router.post('/users',
 *   usersValidation.create,  // express-validator
 *   validationResult,         // check for errors
 *   controller.create
 * );
 * ```
 *
 * New way with Zod:
 * ```typescript
 * router.post('/users',
 *   usersValidationZod.create,  // Zod validation
 *   controller.create            // No need for validationResult
 * );
 * ```
 *
 * The Zod middleware automatically:
 * 1. Validates the input
 * 2. Returns error responses if invalid
 * 3. Transforms and sanitizes data
 * 4. Provides typed data to the controller
 */
