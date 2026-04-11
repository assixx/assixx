/**
 * Forgot Password DTO
 *
 * Public endpoint — accepts email, triggers password reset email.
 * Response is always generic to prevent email enumeration.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema } from '../../../schemas/common.schema.js';

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

export interface ForgotPasswordResponse {
  message: string;
}
