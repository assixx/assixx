/**
 * User Schemas for Assixx
 * Demonstrates Zod best practices from documentation:
 * - Schema composition
 * - Type inference
 * - Transform and refinements
 * - Custom error messages
 */
import { z } from 'zod';

import {
  EmailSchema,
  IdSchema,
  OptionalDateSchema,
  PasswordSchema,
  RoleSchema,
  StatusSchema,
  UsernameSchema,
} from './common.schema';

// ============================================================
// USER BASE SCHEMAS
// ============================================================

/**
 * Base user properties (shared across operations)
 */
const UserBaseSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  first_name: z.string().min(1).max(100).trim().optional(),
  last_name: z.string().min(1).max(100).trim().optional(),
  phone: z
    .string()
    .regex(/^[+]?[\d\s()-]+$/, 'Invalid phone number format')
    .optional(),
  position: z.string().max(100).trim().optional(),
  department_id: z.number().int().positive().nullable().optional(),
  team_id: z.number().int().positive().nullable().optional(),
});

// ============================================================
// CREATE USER SCHEMAS
// ============================================================

/**
 * Schema for creating a new user
 * Includes password and role requirements
 */
export const CreateUserSchema = UserBaseSchema.extend({
  password: PasswordSchema,
  role: RoleSchema.default('employee'),
  status: StatusSchema.default('active'),
});

/**
 * Schema for user self-registration (signup)
 * More restrictive than admin creation
 */
export const UserSignupSchema = z
  .object({
    username: UsernameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    confirm_password: z.string(),
    first_name: z.string().min(1, 'First name is required').max(100).trim(),
    last_name: z.string().min(1, 'Last name is required').max(100).trim(),
    company_name: z.string().min(1, 'Company name is required').max(200).trim(),
    subdomain: z
      .string()
      .min(3, 'Subdomain must be at least 3 characters')
      .max(50)
      .trim()
      .toLowerCase()
      .refine(
        (val) => {
          // Simple validation: lowercase letters, numbers, and hyphens
          // Check: starts and ends with alphanumeric, hyphens only in between
          const parts = val.split('-');
          return parts.every((part) => /^[a-z0-9]+$/.test(part)) && parts.length > 0;
        },
        { message: 'Subdomain can only contain lowercase letters, numbers, and hyphens' },
      ),
    accept_terms: z.literal(true),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// ============================================================
// UPDATE USER SCHEMAS
// ============================================================

/**
 * Schema for updating user (all fields optional)
 * Uses partial() for optional fields
 */
export const UpdateUserSchema = UserBaseSchema.partial().extend({
  role: RoleSchema.optional(),
  status: StatusSchema.optional(),
});

/**
 * Schema for user updating their own profile
 * Excludes sensitive fields like role
 */
export const UpdateProfileSchema = UserBaseSchema.omit({
  username: true, // Username typically can't be changed
}).partial();

/**
 * Schema for changing password
 * Includes current password verification
 */
export const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: PasswordSchema,
    confirm_password: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Schema for user list query parameters
 * Extends common pagination with user-specific filters
 */
export const UserListQuerySchema = z.object({
  // Pagination with string-to-number transform
  page: z.preprocess((val) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return 1;
  }, z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return 10;
  }, z.number().int().min(1).max(100).default(10)),
  // Filters
  search: z.string().optional(),
  role: RoleSchema.optional(),
  status: StatusSchema.optional(),
  department_id: z.preprocess((val) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return undefined;
  }, z.number().int().positive().optional()),
  team_id: z.preprocess((val) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return undefined;
  }, z.number().int().positive().optional()),
  // Sorting
  sortBy: z.enum(['username', 'email', 'created_at', 'last_login']).default('username'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Schema for user ID in URL params
 * Transforms string to number
 */
export const UserIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// RESPONSE SCHEMAS (for type-safe responses)
// ============================================================

/**
 * Schema for user response (without password)
 * Used for API responses
 */
export const UserResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  department_id: z.number().nullable(),
  department_name: z.string().nullable().optional(),
  team_id: z.number().nullable(),
  team_name: z.string().nullable().optional(),
  role: RoleSchema,
  status: StatusSchema,
  tenant_id: z.number(),
  last_login: OptionalDateSchema,
  created_at: z.string().refine(
    (val) => {
      const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      return isoDatePattern.test(val);
    },
    { message: 'Invalid date format' },
  ),
  updated_at: z.string().refine(
    (val) => {
      const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      return isoDatePattern.test(val);
    },
    { message: 'Invalid date format' },
  ),
});

/**
 * Schema for paginated user list response
 */
export const UserListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    users: z.array(UserResponseSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  }),
});

// ============================================================
// TYPE EXPORTS - Automatic type inference
// ============================================================

// Input types (what API receives)
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UserSignupInput = z.infer<typeof UserSignupSchema>;
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

// Output types (what API returns)
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Helper function to validate user data
 * Can be used in services or controllers
 */
export function validateUserData(
  data: unknown,
  operation: 'create' | 'update',
): ReturnType<typeof CreateUserSchema.safeParse> | ReturnType<typeof UpdateUserSchema.safeParse> {
  const schema = operation === 'create' ? CreateUserSchema : UpdateUserSchema;
  return schema.safeParse(data);
}

/**
 * Helper to strip sensitive fields from user object
 * Useful for API responses
 */
export function sanitizeUserResponse(user: Record<string, unknown>): UserResponse {
  // Remove password and other sensitive fields
  // Using destructuring to exclude fields (prefixed with _ to indicate unused)
  const sanitized = Object.fromEntries(
    Object.entries(user).filter(([key]) => !['password', 'password_hash'].includes(key)),
  );
  return UserResponseSchema.parse(sanitized);
}
