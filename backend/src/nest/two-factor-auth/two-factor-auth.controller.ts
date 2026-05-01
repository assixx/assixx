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
 *   `ChallengeRecord.purpose` returned by `verifyChallenge`. The cross-origin
 *   trigger is unified — `purpose === 'signup'` always handoffs (signup runs
 *   on apex by definition), and `purpose === 'login'` handoffs whenever the
 *   request host (`req.raw.hostTenantId`, set by `TenantHostResolverMiddleware`)
 *   does not match the user's tenant — i.e. apex login (`www.assixx.com`,
 *   `localhost:5173`) or cross-subdomain entry. Same-origin login (the user
 *   is already on their tenant subdomain) skips the handoff and writes the
 *   3-cookie auth triad directly. The handoff branch reuses the existing
 *   `OAuthHandoffService` mint primitive and returns `{ token, subdomain }`
 *   plus the `accessToken` (needed by the apex-side `enhance` callback to
 *   mint the ADR-022 escrow unlock ticket before the cross-origin redirect);
 *   the frontend then 303-redirects to the subdomain handoff consumer
 *   (`(public)/signup/oauth-complete/+page.server.ts`) which sets cookies on
 *   the correct origin and lands the user on their dashboard.
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
// ADR-050 §"Backend: Pre-Auth Host Resolver" — `req.raw.hostTenantId` is set
// by `TenantHostResolverMiddleware` before this controller runs. We read it
// to decide whether the verify-success cookies can be set on the request
// origin (same tenant) or whether we must mint a cross-origin handoff
// instead. The `.raw` indirection is mandatory per ADR-050 D17 — the
// middleware writes to the IncomingMessage which Fastify exposes as `.raw`.
import type { HostAwareRequest } from '../common/middleware/tenant-host-resolver.middleware.js';
import { ResendCodeDto, VerifyCodeDto } from './dto/index.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';
import type { TwoFactorResendResponse, TwoFactorVerifyResponse } from './two-factor-auth.types.js';

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
    const loginMethod =
      verified.purpose === 'signup' ? 'password+2fa-email-signup' : 'password+2fa-email';
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

    // ADR-050 §"Backend: Pre-Auth Host Resolver" — three-state value set by
    // `TenantHostResolverMiddleware` BEFORE this controller runs:
    //   - `number`    → request hit a known tenant subdomain
    //   - `null`      → apex / localhost / IP / unknown subdomain
    //   - `undefined` → middleware did not run (should not happen in prod;
    //                   defensive — same handling as `null`)
    const hostTenantId = (req as HostAwareRequest).raw.hostTenantId ?? null;
    const subdomain = session.user.subdomain;

    // Cross-origin trigger: cookies set here would scope to the wrong origin
    // when the verify happened on a host that is NOT the user's tenant
    // subdomain. Concrete cases:
    //   - signup-purpose verify: ALWAYS true — signup runs on apex by
    //     definition (`(public)/signup/` lives on `www.assixx.com`).
    //   - login-purpose verify on apex (`www.assixx.com/login`,
    //     `localhost:5173/login`): hostTenantId = null.
    //   - login-purpose verify on a subdomain that does NOT belong to the
    //     user (cross-tenant input): hostTenantId !== verified.tenantId.
    //
    // In all three cases we mint a handoff token (ADR-050 §OAuth) and the
    // frontend redirects the browser to the user's correct subdomain, where
    // the existing handoff consumer (`signup/oauth-complete/+page.server.ts`)
    // sets cookies on the right origin. The handoff token is opaque, single-
    // use, 60-s TTL, R15-host-checked on consume.
    //
    // Pre-ADR-054 the login-purpose branch unconditionally set cookies on the
    // request origin. After ADR-054 made 2FA mandatory for every password
    // login, that branch became the new "every login goes through here" hot
    // path — exposing the latent assumption "login always runs on the tenant
    // subdomain" which breaks for apex / localhost / cross-subdomain entry
    // points. This branch closes that gap and brings login into parity with
    // the signup verify-success → handoff pattern.
    const needsHandoff =
      verified.purpose === 'signup' || (subdomain !== null && hostTenantId !== verified.tenantId);

    if (!needsHandoff) {
      // Same-origin login (e.g. `firma-a.assixx.com/login` → user belongs to
      // `firma-a`). Cookies land on the correct origin, no handoff needed.
      setAuthCookies(reply, session.accessToken, session.refreshToken);
      return { stage: 'authenticated', user: session.user };
    }

    // Handoff branch. The user.subdomain enrichment in `loginWithVerifiedUser`
    // covers the happy path; greenfield-prod tenants always have a subdomain
    // via the signup DTO regex, so the null-check below is defensive only.
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
    // No setAuthCookies on the request origin — would scope to the wrong
    // host. Frontend MUST follow the handoff redirect, where the consumer
    // sets cookies on the user's tenant subdomain.
    //
    // `accessToken` echoed in the body so the apex-side `use:enhance`
    // callback can mint the ADR-022 escrow unlock ticket BEFORE the
    // cross-origin redirect (see `TwoFactorVerifyForm.svelte` →
    // `mintUnlockTicketOrFallback`). sessionStorage cannot bridge across
    // origins, so the ticket-via-Redis path is the only way to keep E2E
    // recovery working through cross-origin login.
    return {
      stage: 'authenticated',
      user: session.user,
      handoff: { token: handoffToken, subdomain },
      accessToken: session.accessToken,
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
