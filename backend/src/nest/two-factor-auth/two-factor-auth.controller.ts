/**
 * Two-Factor Authentication Controller — Step 2.7 (FEAT_2FA_EMAIL_MASTERPLAN v0.6.0).
 *
 * Houses the TWO public-facing 2FA endpoints that travel with the challenge
 * cookie issued by `POST /auth/login` (Step 2.4) or `POST /signup` (Step 2.5):
 *
 *   - `POST /api/v2/auth/2fa/verify` — submit the 6-character code.
 *   - `POST /api/v2/auth/2fa/resend` — request a fresh code on the same challenge.
 *
 * The third 2FA endpoint (`POST /api/v2/users/:id/2fa/clear-lockout`) lives
 * in a sibling controller (`two-factor-lockout.controller.ts`) because (a)
 * it's mounted under a different URL prefix (`users` vs `auth`) and (b) the
 * project's `max-classes-per-file: 1` ESLint rule rules out a single file.
 *
 * Why `@Public()` on both endpoints:
 *   The user is, by definition, NOT yet authenticated when they hit these
 *   endpoints — the access token is minted only AFTER `verify` succeeds.
 *   `@Public()` skips the global `JwtAuthGuard`. Auth is established via
 *   the opaque `challengeToken` cookie (DD-4) which is single-use, hashed,
 *   and rate-limited at the throttler tier.
 *
 * Login vs. signup branching (verify endpoint):
 *   The verify body is identical for both flows; the discriminator lives in
 *   `ChallengeRecord.purpose` returned by `verifyChallenge`. For `'login'`
 *   we set the 3-cookie auth triad on the same origin (login lives on the
 *   tenant subdomain per ADR-050). For `'signup'` we mint an apex→subdomain
 *   handoff ticket via `OAuthHandoffService` and return its (token, subdomain)
 *   in the body — frontend then 303-redirects to the subdomain handoff
 *   endpoint, which sets cookies on the correct origin.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.7, §A8 audit, R8/R14)
 * @see docs/infrastructure/adr/ADR-005-authentication-strategy.md
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md (handoff)
 * @see docs/infrastructure/adr/ADR-054 (drafted Phase 6 — Mandatory Email-Based 2FA)
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Reuse the cookie-writing helpers exported by AuthController so all auth
// paths (password login, OAuth handoff, 2FA verify) share ONE source of
// truth for cookie shape — divergence here would silently leak cookies
// across paths it should not reach (mirrors signup.controller.ts:28).
import { setAuthCookies } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { OAuthHandoffService } from '../auth/oauth/oauth-handoff.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import {
  TwoFaResendThrottle,
  TwoFaVerifyThrottle,
} from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import { ResendCodeDto, VerifyCodeDto } from './dto/index.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';
import type {
  TwoFactorResendResponse,
  TwoFactorVerifyResponse,
} from './two-factor-auth.types.js';

/**
 * Pull `challengeToken` from the httpOnly cookie set by `/auth/login` or
 * `/signup`. Empty / missing → generic 401. We never echo back which case
 * was hit (R10 — same response shape for "no cookie" and "wrong code").
 */
function readChallengeTokenOrThrow(req: FastifyRequest): string {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.['challengeToken'];
  if (typeof token !== 'string' || token === '') {
    throw new UnauthorizedException('Ungültiger oder abgelaufener Code.');
  }
  return token;
}

/**
 * Extract IP + user-agent for the post-verify login audit (mirrors
 * `auth.controller.ts:309 getClientInfo` and `signup.controller.ts:40`).
 * Local copy keeps the controller self-contained — no cross-controller
 * helper coupling.
 */
function getClientInfo(req: FastifyRequest): {
  ipAddress: string;
  userAgent: string | undefined;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('auth/2fa')
export class TwoFactorAuthController {
  constructor(
    private readonly twoFactorAuth: TwoFactorAuthService,
    // forwardRef: AuthModule already imports TwoFactorAuthModule (Step 2.4),
    // so this back-edge closes the cycle. Mirrors the canonical
    // `AuthModule ↔ OAuthModule` cycle resolution (auth.module.ts:36).
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => OAuthHandoffService))
    private readonly handoffService: OAuthHandoffService,
  ) {}

  /**
   * `POST /api/v2/auth/2fa/verify` — submit the 6-character code.
   *
   * Order of operations (atomicity-relevant — see header for failure semantics):
   *   1. Read challenge token from cookie.
   *   2. `verifyChallenge(token, code)` — consumes the challenge on success
   *      (single-use, R8). On wrong code: increments fail-streak, possibly
   *      triggers 15-min lockout, throws 401/403; cookie is NOT cleared so
   *      the user can retry on the same challenge.
   *   3. `markVerified(userId, tenantId, purpose)` — stamps user row state
   *      (DD-11 transparent enrollment + signup activation).
   *   4. `loginWithVerifiedUser(...)` — mints access + refresh tokens,
   *      writes the standard login audit, returns the safe user payload.
   *      Reuses the existing OAuth-style "identity already verified" entry
   *      point — DD-7 still holds (OAuth-only at the issueChallenge layer);
   *      this method is now correctly named "any pre-verified login".
   *   5. Clear challenge cookie regardless of branch (single-use is now spent).
   *   6. Login branch: set 3-cookie auth triad on the same origin → return
   *      `{ stage, user }`. Signup branch: mint handoff ticket → return
   *      `{ stage, user, handoff }`; cookies NOT set on apex (would scope to
   *      the wrong origin).
   *
   * Failure recovery:
   *   - Steps 3/4 failing AFTER step 2 leave the challenge consumed but the
   *     user able to log in fresh. Acceptable — alternative would be a
   *     compensating "re-issue" path that complicates the happy path.
   */
  @Post('verify')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @TwoFaVerifyThrottle()
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() dto: VerifyCodeDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<TwoFactorVerifyResponse> {
    const token = readChallengeTokenOrThrow(req);
    const verified = await this.twoFactorAuth.verifyChallenge(token, dto.code);
    await this.twoFactorAuth.markVerified(verified.userId, verified.tenantId, verified.purpose);

    const { ipAddress, userAgent } = getClientInfo(req);
    // Method string lands in the audit row's `new_values.login_method` —
    // distinct from plain `'password'` so audit queries can isolate
    // 2FA-gated logins from the (currently unreachable) bypass path.
    const loginMethod = verified.purpose === 'signup' ? 'password+2fa-email-signup' : 'password+2fa-email';
    const session = await this.authService.loginWithVerifiedUser(
      verified.userId,
      verified.tenantId,
      loginMethod,
      ipAddress,
      userAgent,
    );

    // Single-use is spent; clear regardless of branch so a stale cookie can't
    // hit verify again. Path mirrors `CHALLENGE_COOKIE_OPTIONS.path = '/'`.
    reply.clearCookie('challengeToken', { path: '/' });

    if (verified.purpose === 'login') {
      // Login lives on `<tenant>.assixx.com/login` (ADR-050) — cookies set
      // here scope to the correct origin. No handoff needed.
      setAuthCookies(reply, session.accessToken, session.refreshToken);
      return { stage: 'authenticated', user: session.user };
    }

    // signup branch — apex→subdomain handoff (ADR-050 §OAuth pattern).
    // The user.subdomain enrichment in `loginWithVerifiedUser` covers the
    // happy path; greenfield-prod tenants always have a subdomain via the
    // signup DTO regex, so the null-check below is defensive only.
    const subdomain = session.user.subdomain;
    if (subdomain === null) {
      throw new NotFoundException({
        code: 'TWO_FA_VERIFY_NO_SUBDOMAIN',
        message: 'Tenant has no subdomain configured for handoff.',
      });
    }
    const handoffToken = await this.handoffService.mint({
      userId: verified.userId,
      tenantId: verified.tenantId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    // No setAuthCookies on apex — would scope to `www.assixx.com`, useless
    // for `<tenant>.assixx.com`. Frontend MUST follow the handoff redirect.
    return {
      stage: 'authenticated',
      user: session.user,
      handoff: { token: handoffToken, subdomain },
    };
  }

  /**
   * `POST /api/v2/auth/2fa/resend` — request a fresh code on the SAME
   * challenge token. Service-side enforces DD-9 (60 s cooldown) + DD-21
   * (3 resends per challenge) — overflow → 429 from the service layer.
   *
   * The Redis record is updated in place (`updateChallenge` overwrites + PEXPIREs),
   * so the existing httpOnly cookie keeps working — no cookie re-write here.
   * Body payload is empty (`ResendCodeDto`); `_dto` is consumed only to satisfy
   * the global validation pipe (rejects extra fields).
   */
  @Post('resend')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @TwoFaResendThrottle()
  @HttpCode(HttpStatus.OK)
  async resend(
    @Body() _dto: ResendCodeDto,
    @Req() req: FastifyRequest,
  ): Promise<TwoFactorResendResponse> {
    const token = readChallengeTokenOrThrow(req);
    const challenge = await this.twoFactorAuth.resendChallenge(token);
    // Strip challengeToken before responding — R8 (token never in body).
    return {
      challenge: {
        expiresAt: challenge.expiresAt,
        resendAvailableAt: challenge.resendAvailableAt,
        resendsRemaining: challenge.resendsRemaining,
      },
    };
  }
}
