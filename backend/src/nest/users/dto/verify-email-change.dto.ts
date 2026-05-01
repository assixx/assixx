/**
 * Verify-Email-Change DTO — body of POST /api/v2/users/me/email/verify-change.
 *
 * Step 2.12 (FEAT_2FA_EMAIL_MASTERPLAN, DD-32 / R15): atomic two-code commit
 * for the email-change flow. BOTH codes (one delivered to the current address,
 * one to the prospective address) must verify within the same request before
 * any `UPDATE users SET email = ...` is committed. If either side fails, no
 * UPDATE happens AND both Redis-side challenges are DEL'd (anti-persistence:
 * an attacker who happens to crack one of the two codes cannot retry with
 * a fresh wrong-code attempt while keeping the correct one alive).
 *
 * Both fields reuse the same regex + normalisation as `VerifyCodeSchema`
 * (`two-factor-auth/dto/verify-code.dto.ts`) — Crockford-Base32 6-char subset
 * (DD-1 / DD-12 / DD-17 v0.3.1, excludes confusables 0/1/I/L/O), trimmed +
 * uppercased before regex check.
 *
 * NOTE: both `challengeToken` cookies (`emailChangeOldChallenge` +
 * `emailChangeNewChallenge`) are read by the controller, NOT from the body —
 * single source of truth (R8).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.12, DD-32, R15)
 * @see ADR-030 Zod Validation Architecture.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CodeField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJKMNP-Z2-9]{6}$/, 'Code muss aus 6 Zeichen (A-Z ohne O/I/L, Ziffern 2-9) bestehen');

export const VerifyEmailChangeSchema = z.object({
  /** Code from the mail sent to the current address (`purpose='email-change-old'`). */
  codeOld: CodeField,
  /** Code from the mail sent to the prospective address (`purpose='email-change-new'`). */
  codeNew: CodeField,
});

export class VerifyEmailChangeDto extends createZodDto(VerifyEmailChangeSchema) {}
