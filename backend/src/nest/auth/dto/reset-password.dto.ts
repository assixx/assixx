/**
 * Reset Password DTO
 *
 * Public endpoint — validates token + new password.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PasswordSchema } from '../../../schemas/common.schema.js';

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordSchema,
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export interface ResetPasswordResponse {
  message: string;
}
