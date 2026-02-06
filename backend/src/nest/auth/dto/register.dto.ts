/**
 * Register DTO
 *
 * Validation schema for user registration requests.
 * Only admins and root users can register new users.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema } from '../../../schemas/common.schema.js';

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
  password: RegistrationPasswordSchema,
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
