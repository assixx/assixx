/**
 * Verify-Code DTO — body of POST /api/v2/auth/2fa/verify.
 *
 * WHY: Zod normalises and validates the code BEFORE the service layer sees
 * it. `.trim()` drops copy-paste whitespace; `.toUpperCase()` normalises
 * lowercase input from mobile keyboards (HTML `autocapitalize="characters"`
 * is best-effort, so we fail-safe server-side). The Crockford-Base32 alphabet
 * (v0.3.1) excludes the confusables 0/1/I/L/O.
 *
 * NOTE: `challengeToken` is read from the httpOnly cookie by the controller,
 * NOT from the request body — single source of truth (R8).
 *
 * References:
 *   - DD-1 / DD-12 / DD-17 (v0.3.1): 6-char alphanumeric Crockford-Base32 subset.
 *   - ADR-030: Zod Validation Architecture.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-HJKMNP-Z2-9]{6}$/,
      'Code muss aus 6 Zeichen (A-Z ohne O/I/L, Ziffern 2-9) bestehen',
    ),
});

export class VerifyCodeDto extends createZodDto(VerifyCodeSchema) {}
