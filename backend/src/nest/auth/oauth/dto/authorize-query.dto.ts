/**
 * `GET /auth/oauth/microsoft/authorize?mode=login|signup`
 *
 * The mode determines:
 *   - The Microsoft prompt parameter (none vs. consent)
 *   - Post-callback routing: link-lookup (login) vs. ticket-creation (signup)
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.6 — controller endpoints)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AuthorizeQuerySchema = z.object({
  mode: z.enum(['login', 'signup']),
});

export class AuthorizeQueryDto extends createZodDto(AuthorizeQuerySchema) {}
