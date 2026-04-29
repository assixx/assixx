/**
 * Request-Email-Change DTO — body of POST /api/v2/users/me/email/request-change.
 *
 * Step 2.12 (FEAT_2FA_EMAIL_MASTERPLAN, DD-32 / R15): the self-service email-
 * change flow MUST be 2FA-verified at both addresses (old + new) before any
 * `UPDATE users SET email = ...` lands. Without this gate a session-hijacker
 * (XSS, stolen cookie, open laptop, insider) could pivot a session into a
 * permanent account takeover by changing the registered mail to one they
 * control — every future 2FA code would then go to the attacker.
 *
 * Zod here only validates the SHAPE: well-formed email, normalised
 * (lowercase + trim) — exactly the same `EmailSchema` the user records were
 * created with, so a uniqueness check at the service layer is meaningful.
 *
 * The "newEmail !== currentUser.email" refinement is INTENTIONALLY at the
 * service layer (not in Zod): the schema does not know the caller's identity.
 * The service compares against the authenticated user's row inside the
 * `tenantTransaction()` for an atomic read-then-decide.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.12, DD-32, R15)
 * @see ADR-030 Zod Validation Architecture.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema } from '../../../schemas/common.schema.js';

export const RequestEmailChangeSchema = z.object({
  newEmail: EmailSchema,
});

export class RequestEmailChangeDto extends createZodDto(RequestEmailChangeSchema) {}
