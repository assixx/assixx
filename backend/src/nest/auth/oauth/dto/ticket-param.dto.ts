/**
 * `:id` param DTO for `GET /auth/oauth/microsoft/signup-ticket/:id` (Plan §5.4).
 *
 * The `id` is a UUIDv7 string issued by `OAuthService.resolveSignupContinue`
 * (see oauth.service.ts). We validate the standard 8-4-4-4-12 hex layout with
 * a version-agnostic regex — that way historical UUIDv4 IDs (should any leak
 * through a Redis migration) still parse, and future UUIDv8 / whatever comes
 * next keeps working without a code change.
 *
 * Rejecting malformed params at the pipe level shrinks the attack surface of
 * the Redis GET call (no risk of key-injection style inputs).
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 5, Step 5.4)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TicketParamSchema = z.object({
  id: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid signup ticket id',
    ),
});

export class TicketParamDto extends createZodDto(TicketParamSchema) {}
