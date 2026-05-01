/**
 * Register DTO
 *
 * Validation schema for user registration requests.
 * Only admins and root users can register new users.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema, PasswordSchema } from '../../../schemas/common.schema.js';

// WHY (2026-04-30): the prior local `RegistrationPasswordSchema` (min(8) + narrow regex
// `[!$%&*?@]`) duplicated and contradicted the canonical `PasswordSchema` (min(12) +
// full special-char class). The duplicate let registrations through with weaker passwords
// than password-reset would accept. Unified onto `PasswordSchema` — single source of truth
// for the "all 4 categories" policy.

/**
 * Name validation schema
 */
const NameSchema = z
  .string()
  .trim()
  .min(2, 'Must be at least 2 characters')
  .max(50, 'Must not exceed 50 characters');

/**
 * Register request body schema
 */
export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  role: z.enum(['employee', 'admin']).default('employee'),
});

/**
 * Register DTO class
 */
export class RegisterDto extends createZodDto(RegisterSchema) {}

/**
 * Register response type
 */
export interface RegisterResponse {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: number;
  createdAt: string;
}
