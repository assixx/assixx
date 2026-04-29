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

/**
 * Public-facing challenge metadata — what travels in the HTTP response body.
 *
 * Strips `challengeToken` from `TwoFactorChallenge` (R8 mitigation — the
 * token never appears in the response body; it travels exclusively via the
 * httpOnly+Secure+SameSite=Lax cookie set by the controller). Controllers
 * MUST return this shape, NEVER the raw `TwoFactorChallenge`.
 */
export type PublicTwoFactorChallenge = Omit<TwoFactorChallenge, 'challengeToken'>;

/**
 * HTTP response body shape for `POST /auth/login` (and `POST /signup` after
 * Step 2.5). Mirrors `LoginResult` — the service-layer return — but with the
 * challenge token stripped: the controller transcribes the token into the
 * httpOnly challenge cookie before responding (R8 + R14 — same-origin set
 * + verify, no token in JS-readable surface).
 *
 * Under v0.5.0 (DD-10 removed) the password-login path always emits
 * `'challenge_required'`. The `'authenticated'` branch is reachable only via
 * paths that bypass the 2FA layer (today: OAuth via `loginWithVerifiedUser()`,
 * exempt per DD-7) and is preserved here for compile-time exhaustiveness so
 * a future per-tenant skip flag (V2) can re-introduce a tokens-in-body shape
 * without re-typing the controller.
 */
export type LoginResultBody =
  | { stage: 'challenge_required'; challenge: PublicTwoFactorChallenge }
  | ({ stage: 'authenticated' } & LoginResponse);

/**
 * HTTP response body shape for `POST /auth/2fa/verify` (Step 2.7).
 *
 * Always `stage: 'authenticated'` — by the time this body is returned the
 * code has been consumed (`verifyChallenge` is single-use), the user row has
 * been stamped with `last_2fa_verified_at` (and `tfa_enrolled_at` on first
 * 2FA), and tokens have been minted.
 *
 * `handoff` is present ONLY for signup-purpose verifies. Signup runs on apex
 * (`www.assixx.com/signup/verify` — DTO requires the new tenant's subdomain),
 * so cookies set on apex would scope to the wrong origin. The handoff
 * payload reuses the OAuth subdomain-bridge primitive (`OAuthHandoffService`,
 * ADR-050 §OAuth) — frontend redirects 303 to
 * `https://${subdomain}.assixx.com/handoff?ticket=${token}`, the existing
 * handoff endpoint consumes the ticket and writes cookies on the correct
 * origin. Login-purpose verifies happen on the tenant subdomain itself, so
 * cookies are set on the same origin and `handoff` is omitted.
 *
 * Under `exactOptionalPropertyTypes` (ADR-041) the `handoff?` field must be
 * literally absent when not used (never `undefined`) — frontend guards via
 * `'handoff' in response` or `response.handoff !== undefined` are both safe
 * because the controller constructs the object with or without the key.
 */
export interface TwoFactorVerifyResponse {
  stage: 'authenticated';
  user: LoginResponse['user'];
  handoff?: { token: string; subdomain: string };
}

/**
 * HTTP response body shape for `POST /auth/2fa/resend` (Step 2.7).
 *
 * Strips `challengeToken` from the underlying `TwoFactorChallenge` (R8 — token
 * never in body). The resend reuses the SAME challenge token in Redis (see
 * `TwoFactorAuthService.resendChallenge` — `updateChallenge` overwrites in
 * place), so the existing httpOnly cookie continues to work; the controller
 * does NOT need to re-set the cookie on resend.
 */
export interface TwoFactorResendResponse {
  challenge: PublicTwoFactorChallenge;
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
