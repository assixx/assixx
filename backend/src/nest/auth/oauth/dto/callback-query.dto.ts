/**
 * `GET /auth/oauth/microsoft/callback`
 *
 * Microsoft's OAuth2 callback supports two response shapes (RFC 6749 §4.1.2):
 *   success: ?code=...&state=...
 *   error:   ?error=...&error_description=...&state=...   (e.g. user denied consent)
 *
 * The DTO accepts either shape; the controller branches on which fields are present.
 * `state` is always required so we can correlate the response with the Redis-stored
 * code_verifier even on the error path.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.6)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Base shape extracted into its own const so we can derive the inferred type for
 * the .refine() callback without violating @typescript-eslint/typedef and without
 * fighting `exactOptionalPropertyTypes` (which distinguishes `?: T` from `?: T | undefined`).
 */
const CallbackQueryShape = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1),
  error: z.string().min(1).optional(),
  error_description: z.string().optional(),
});

type CallbackQueryData = z.infer<typeof CallbackQueryShape>;

export const CallbackQuerySchema = CallbackQueryShape.refine(
  (data: CallbackQueryData): boolean => data.code !== undefined || data.error !== undefined,
  { message: 'Callback must include either `code` (success) or `error` (denied/failed)' },
);

export class CallbackQueryDto extends createZodDto(CallbackQuerySchema) {}
