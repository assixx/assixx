/**
 * Two-Factor Authentication (Email-Based) — Type definitions.
 *
 * WHY: The discriminated union `LoginResult` forces the auth controller AND
 * the SvelteKit frontend to handle BOTH authentication stages at compile time
 * (ADR-041 strict-everywhere). Without the discriminator, a developer could
 * accidentally treat a `challenge_required` response as authenticated and
 * skip the 2FA gate.
 *
 * References:
 *   - Masterplan: docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.1)
 *   - ADR-005 (Auth Strategy) — JWT contract unchanged; 2FA layer is additive.
 *   - ADR-007 (API Response Standardization) — services return raw data; the
 *     ResponseInterceptor envelopes it.
 *   - DD-4 (challenge token format) — opaque base64url, single-use, Redis-backed.
 */
import type { LoginResponse } from '../auth/dto/login.dto.js';

/**
 * Result of a password-login attempt.
 *
 * - `challenge_required`: credentials valid → 2FA code emailed → frontend
 *   redirects user to `/login/verify`. The challenge token is set as an
 *   httpOnly cookie by the controller (NEVER returned in the body — see R8).
 * - `authenticated`: only reachable via OAuth path (DD-7 exempt). Password
 *   logins always go through the challenge stage post-cutover; DD-10 was
 *   removed in v0.5.0, so 2FA is hardcoded with no flag fallback.
 */
export type LoginResult =
  | { stage: 'challenge_required'; challenge: TwoFactorChallenge }
  | ({ stage: 'authenticated' } & LoginResponse);

/**
 * Public-facing challenge metadata returned in the response body.
 *
 * NOTE: `challengeToken` is included on the type so the controller can read it
 * for cookie wiring, but the controller MUST strip it before returning to the
 * client — token travels exclusively via the httpOnly+Secure+SameSite=Lax
 * cookie (R8 mitigation).
 */
export interface TwoFactorChallenge {
  /** Opaque base64url, ~43 chars from 32 random bytes (DD-4). */
  challengeToken: string;
  /** ISO 8601 timestamp when the code expires (CODE_TTL_SEC from now). */
  expiresAt: string;
  /** ISO 8601 timestamp when the next resend is allowed (RESEND_COOLDOWN_SEC). */
  resendAvailableAt: string;
  /** Resends remaining on this challenge (DD-21, decremented per resend). */
  resendsRemaining: number;
}

/** Either signup-flow verification or login-flow verification. */
export type ChallengePurpose = 'login' | 'signup';

/**
 * Internal record persisted at Redis key `2fa:challenge:{token}` with TTL
 * `CODE_TTL_SEC`. NEVER returned to the client. Code is stored as a hash
 * (DD-3) so a Redis dump leak does not directly expose live codes.
 *
 * Invariant: `tenantId` is never null — tenant rows are inserted BEFORE user
 * rows in the signup flow (verified in `signup.service.ts`), and login always
 * reads `tenantId` from the existing user row.
 */
export interface ChallengeRecord {
  userId: number;
  tenantId: number;
  email: string;
  purpose: ChallengePurpose;
  /** sha256(userId + ':' + code + ':' + purpose) — see TwoFactorCodeService.hashCode (DD-3). */
  codeHash: string;
  /** Wrong-code counter for THIS challenge (reset on resend per DD-9). */
  attemptCount: number;
  /** Resend counter for THIS challenge (capped at MAX_RESENDS_PER_CHALLENGE per DD-21). */
  resendCount: number;
  /** ISO 8601 — challenge issuance timestamp. */
  createdAt: string;
}
