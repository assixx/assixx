/**
 * Email-Change Controller — self-service `users.email` mutation gated by
 * two-code 2FA.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.12 (v0.6.0, DD-32 / R15).
 *
 * Routes:
 *   POST /api/v2/users/me/email/request-change → issues two challenges
 *   POST /api/v2/users/me/email/verify-change  → atomic two-code commit
 *
 * The flow (per masterplan §2.12 / DD-32):
 *
 *   request-change → mail to OLD address (purpose='email-change-old')
 *                  + mail to NEW address (purpose='email-change-new')
 *                  → set two httpOnly+Secure+SameSite=Lax cookies
 *                    `emailChangeOldChallenge` / `emailChangeNewChallenge`
 *                    (max-age = `CODE_TTL_SEC` so cookie cannot outlive Redis)
 *
 *   verify-change → reads BOTH cookies, calls EmailChangeService which
 *                   verifies both codes, on success UPDATEs `users.email`
 *                   atomically + audits + consumes both challenges.
 *                   On failure: anti-persistence DEL on both, suspicious-
 *                   activity mail to old address, 401 generic, both cookies
 *                   cleared regardless.
 *
 * WHY a separate controller (not folded into UsersController):
 *   `max-classes-per-file: 1` rule + SRP — UsersController is admin CRUD +
 *   self-edit profile-field map. This is a security-gated identity-mutation
 *   state machine with its own throttler tiers, two cookies, and atomic
 *   Redis+SQL semantics. Same precedent as
 *   `two-factor-auth/two-factor-lockout.controller.ts` splitting from
 *   `two-factor-auth.controller.ts` for SRP.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.12, DD-32, R15)
 * @see ADR-005 Authentication Strategy.
 * @see ADR-019 Multi-Tenant RLS Isolation.
 */
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthThrottle, TwoFaVerifyThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { CODE_TTL_SEC } from '../two-factor-auth/two-factor-auth.constants.js';
import type { PublicTwoFactorChallenge } from '../two-factor-auth/two-factor-auth.types.js';
import { RequestEmailChangeDto, VerifyEmailChangeDto } from './dto/index.js';
import { EmailChangeService } from './email-change.service.js';

/** Cookie names — kept in lockstep with the throttler tracker fallback. */
const OLD_COOKIE = 'emailChangeOldChallenge';
const NEW_COOKIE = 'emailChangeNewChallenge';

/**
 * Cookie shape — mirrors `CHALLENGE_COOKIE_OPTIONS` from `auth.controller.ts`
 * with `maxAge` keyed off `CODE_TTL_SEC` so the cookie's browser lifetime
 * cannot outlive the Redis-side challenge record (single source of truth,
 * Step 2.4 precedent).
 */
const EMAIL_CHANGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: CODE_TTL_SEC,
};

/** Public response shape for `request-change`. Tokens stripped per R8. */
interface RequestEmailChangeResponse {
  stage: 'challenge_required';
  oldChallenge: PublicTwoFactorChallenge;
  newChallenge: PublicTwoFactorChallenge;
}

/** Public response shape for `verify-change`. */
interface VerifyEmailChangeResponse {
  stage: 'authenticated';
  oldEmail: string;
  newEmail: string;
}

@Controller('users/me/email')
@UseGuards(CustomThrottlerGuard)
export class EmailChangeController {
  constructor(private readonly emailChange: EmailChangeService) {}

  /**
   * Step 1 — request the email change. Authenticated; the user's identity
   * comes from the JWT (CLS-populated `currentUser`), NEVER from request
   * body or query (defense against CSRF-driven hijack).
   *
   * Throttled with `@AuthThrottle()` (10 / 5 min per IP|user) to cap mail-
   * bombing attempts: an attacker who steals a session cannot iterate
   * thousands of `newEmail` values to spam arbitrary inboxes — the IP-keyed
   * limit caps the blast radius even if the per-user limit somehow doesn't.
   *
   * Response cookies:
   *   - `emailChangeOldChallenge` (httpOnly+Secure+SameSite=Lax, maxAge=CODE_TTL_SEC)
   *   - `emailChangeNewChallenge` (same shape)
   * Tokens are present on the cookies, NEVER on the response body (R8).
   */
  @Post('request-change')
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async requestChange(
    @CurrentUser() currentUser: NestAuthUser,
    @Body() dto: RequestEmailChangeDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RequestEmailChangeResponse> {
    const result = await this.emailChange.requestChange(
      currentUser.id,
      currentUser.tenantId,
      currentUser.email,
      dto.newEmail,
    );

    reply.setCookie(OLD_COOKIE, result.oldChallenge.challengeToken, EMAIL_CHANGE_COOKIE_OPTIONS);
    reply.setCookie(NEW_COOKIE, result.newChallenge.challengeToken, EMAIL_CHANGE_COOKIE_OPTIONS);

    return {
      stage: 'challenge_required',
      oldChallenge: stripToken(result.oldChallenge),
      newChallenge: stripToken(result.newChallenge),
    };
  }

  /**
   * Step 2 — atomic two-code commit. Reads both cookies, runs the service-
   * side atomic dance. Cookies are cleared in BOTH success and failure
   * branches (failure already DEL'd the Redis records inside the service;
   * success consumed them). A leftover cookie pointing at a dead Redis
   * record would just be a 401 on the next attempt, so this is defensive
   * tidiness not a security gate.
   *
   * Throttled with `@TwoFaVerifyThrottle()` (5 / 10 min per emailChangeOld
   * cookie via the tracker's fallback chain). Service-layer protections
   * (per-challenge attemptCount + per-user fail-streak + lockout) remain
   * the actual brute-force defence — the throttler is a denial-of-service
   * cap, not the primary gate.
   */
  @Post('verify-change')
  @TwoFaVerifyThrottle()
  @HttpCode(HttpStatus.OK)
  async verifyChange(
    @CurrentUser() currentUser: NestAuthUser,
    @Body() dto: VerifyEmailChangeDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<VerifyEmailChangeResponse> {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
    const oldToken = cookies?.[OLD_COOKIE] ?? '';
    const newToken = cookies?.[NEW_COOKIE] ?? '';

    try {
      const result = await this.emailChange.verifyChange(
        currentUser.id,
        currentUser.tenantId,
        currentUser.email,
        oldToken,
        dto.codeOld,
        newToken,
        dto.codeNew,
      );
      return { stage: 'authenticated', oldEmail: result.oldEmail, newEmail: result.newEmail };
    } finally {
      // Clear both cookies regardless of outcome — failure: avoid retry with
      // stale cookies pointing at DEL'd records; success: consumed Redis-side
      // already. Path mirrors the cookie-set call so the browser actually
      // clears it (RFC 6265 — clear must match path).
      reply.clearCookie(OLD_COOKIE, { path: EMAIL_CHANGE_COOKIE_OPTIONS.path });
      reply.clearCookie(NEW_COOKIE, { path: EMAIL_CHANGE_COOKIE_OPTIONS.path });
    }
  }
}

/**
 * R8 — strip the raw `challengeToken` from the public-facing challenge view
 * so the token only ever travels on the httpOnly cookie. Called twice per
 * request-change response (once per side).
 */
function stripToken(challenge: {
  challengeToken: string;
  expiresAt: string;
  resendAvailableAt: string;
  resendsRemaining: number;
}): PublicTwoFactorChallenge {
  const { expiresAt, resendAvailableAt, resendsRemaining } = challenge;
  return { expiresAt, resendAvailableAt, resendsRemaining };
}
