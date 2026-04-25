/**
 * Update User-Password-Change-Policy DTO
 *
 * Validation schema for `PUT /security-settings/user-password-change-policy`.
 * Only Root may call this endpoint (enforced via `@Roles('root')` on the
 * controller method) — the DTO itself stays minimal because the single
 * boolean has no additional business rules.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateUserPasswordChangePolicySchema = z.object({
  /** `true` = non-root users may change their own password, `false` = locked. */
  allowed: z.boolean(),
});

export class UpdateUserPasswordChangePolicyDto extends createZodDto(
  UpdateUserPasswordChangePolicySchema,
) {}
