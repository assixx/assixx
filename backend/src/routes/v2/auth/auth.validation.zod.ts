/**
 * Auth API v2 Validation with Zod
 * Replaces express-validator with Zod for authentication endpoints
 *
 * Benefits over express-validator:
 * 1. Type inference - automatic TypeScript types
 * 2. Better composition and reusability
 * 3. More readable schema definitions
 * 4. Better error messages
 */
import { z } from 'zod';

import { validateBody } from '../../../middleware/validation.zod.js';
import { EmailSchema, PasswordSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Enhanced password schema for registration
 * Requires special character in addition to uppercase, lowercase, and number
 */
const RegistrationPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!$%&*?@])[\d!$%&*?@A-Za-z]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
  );

/**
 * Name validation for registration
 */
const NameSchema = z
  .string()
  .trim()
  .min(2, 'Must be at least 2 characters')
  .max(50, 'Must not exceed 50 characters');

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Login request body
 */
export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Register request body
 */
export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: RegistrationPasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  role: z.enum(['employee', 'admin']).optional(),
});

/**
 * Refresh token request body
 */
export const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type RefreshTokenBody = z.infer<typeof RefreshTokenBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for auth routes
 */
export const authValidationZod = {
  login: validateBody(LoginBodySchema),
  register: validateBody(RegisterBodySchema),
  refresh: validateBody(RefreshTokenBodySchema),
};
