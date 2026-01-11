/**
 * Login DTO
 *
 * Validation schema for login requests using Zod.
 * Reuses existing schemas from common.schema.ts
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema, PasswordSchema } from '../../../schemas/common.schema.js';

/**
 * Login request body schema
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Login DTO class
 * Provides type inference and validation
 */
export class LoginDto extends createZodDto(LoginSchema) {}

/**
 * Login response type
 * Note: Using explicit `| undefined` instead of `?` for exactOptionalPropertyTypes compliance
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string | undefined;
    lastName: string | undefined;
    role: string;
    tenantId: number;
  };
}
