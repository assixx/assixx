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

/**
 * Response DTO for POST /auth/forgot-password.
 *
 * Additive shape (ADR-051, Plan v0.4.4 §2.2 / §0.2.5 #6):
 * - Root / silent-drop paths: `{ message }` only — byte-identical for R1 enumeration safety.
 * - Admin/Employee blocked path: adds `blocked: true` + `reason: 'ROLE_NOT_ALLOWED'`.
 *   Old clients reading only `message` still function (graceful degrade to generic success).
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.2
 */
export interface ForgotPasswordResponse {
  readonly message: string;
  /** Present only when the request was blocked due to non-root role. Omitted on root + silent-drop paths. */
  readonly blocked?: true;
  readonly reason?: 'ROLE_NOT_ALLOWED';
}
