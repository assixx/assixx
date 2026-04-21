/**
 * OAuth Controller — HTTP surface for Microsoft sign-in (plan §2.6).
 *
 * Endpoints (5 total — 3 active + 2 V2 stubs):
 *   GET  /auth/oauth/microsoft/authorize       Public  — 302 to Microsoft
 *   GET  /auth/oauth/microsoft/callback        Public  — code exchange + redirect
 *   POST /auth/oauth/microsoft/complete-signup Public  — finalise OAuth signup
 *   POST /auth/oauth/microsoft/link            Auth    — V2 stub (501)
 *   DELETE /auth/oauth/microsoft/link          Auth    — V2 stub (501)
 *
 * Redirects use RELATIVE paths (`/dashboard`, `/login?...`, `/signup/oauth-complete?...`)
 * so the browser stays on its current host — production Nginx + dev Vite proxy
 * both route these correctly. Absolute URLs would require a second env var
 * (frontend root URL) separate from `PUBLIC_APP_URL`; not worth it for V1.
 *
 * Cookies on login-success + complete-signup use the IDENTICAL shape AuthController
 * uses for password login — via the shared `setAuthCookies()` helper imported
 * from `auth.controller.ts`. That helper centralises the 3-cookie invariant
 * (accessToken + refreshToken + accessTokenExp) so any auth entry point writes
 * the same session shape. No duplication.
 *
 * Module wiring: circular module dep between AuthModule (which imports OAuthModule)
 * and OAuthModule (which now needs AuthService) is resolved with `forwardRef()` on
 * both sides — Spec Deviation D15, documented in §Spec Deviations. Canonical NestJS
 * pattern, see https://docs.nestjs.com/fundamentals/circular-dependency.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.6)
 * @see ADR-005 (auth strategy) + ADR-046 (to be written in Phase 6)
 */
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators/public.decorator.js';
import { AuthThrottle } from '../../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../../common/guards/throttler.guard.js';
import { getErrorMessage } from '../../common/utils/error.utils.js';
import type { SignupResponseData } from '../../signup/dto/index.js';
// Reuse — single source of truth for the 3-cookie session shape
// (access/refresh/accessTokenExp). See auth.controller.ts `setAuthCookies`.
import { setAuthCookies } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import {
  AuthorizeQueryDto,
  CallbackQueryDto,
  CompleteSignupDto,
  TicketParamDto,
} from './dto/index.js';
import { OAuthService } from './oauth.service.js';
import type { SignupTicketPreview } from './oauth.types.js';

/** Login method label recorded in `root_logs.new_values.login_method` for forensics. */
const OAUTH_LOGIN_METHOD = 'oauth-microsoft';

/** Shape returned after a successful OAuth signup (signup data + cookie side-effects). */
interface OAuthCompleteSignupResponse extends SignupResponseData {
  /** Echoes the HTTP login result so SPA clients can keep tokens in memory if desired. */
  accessToken: string;
  refreshToken: string;
}

/** Client-info helper — duplicated from auth.controller intentionally (tiny, no lib). */
function getClientInfo(req: FastifyRequest): {
  ipAddress: string;
  userAgent: string | undefined;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

/**
 * URL-encode an arbitrary provider error string so redirect targets like
 * `/login?oauth=error&reason={...}` stay well-formed even on weird Microsoft
 * error codes ("consent_required", "AADSTS50...", etc.).
 */
function sanitiseErrorReason(error: string): string {
  // Drop any non-ascii + curly / angle brackets for safety — narrow whitelist.
  const stripped = error.replace(/[^a-z0-9_.\-: ]/gi, '');
  return encodeURIComponent(stripped.slice(0, 80));
}

@Controller('auth/oauth/microsoft')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    // forwardRef: AuthModule imports OAuthModule AND OAuthModule needs AuthService
    // → circular. NestJS canonical resolution (see @see in file header).
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /auth/oauth/microsoft/authorize?mode=login|signup
   *
   * Builds the Microsoft authorize URL (with fresh PKCE + state) and 302s the
   * browser to it. `mode` drives the post-callback routing decision.
   */
  @Get('authorize')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async authorize(
    @Query() query: AuthorizeQueryDto,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const { url } = await this.oauthService.startAuthorization(query.mode);
    await reply.redirect(url, HttpStatus.FOUND);
  }

  /**
   * GET /auth/oauth/microsoft/callback
   *
   * Microsoft sends the browser here after the user consents (or denies).
   * Success: `?code=...&state=...`   → exchange + verify + route.
   * Error:   `?error=...&state=...`  → redirect to login with the reason.
   *
   * All four non-error outcomes translate to 302 redirects onto the frontend:
   *   login-success    → `/dashboard` (+ JWT cookies set)
   *   login-not-linked → `/login?oauth=not-linked`
   *   signup-continue  → `/signup/oauth-complete?ticket={uuid}`
   *   provider-error   → `/login?oauth=error&reason=...`
   */
  @Get('callback')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async callback(
    @Query() query: CallbackQueryDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    // Provider-error path (user cancelled consent, Azure tenant mismatch, etc.).
    if (query.error !== undefined) {
      const reason = sanitiseErrorReason(query.error);
      this.logger.warn(`OAuth provider error: ${query.error}`);
      await reply.redirect(`/login?oauth=error&reason=${reason}`, HttpStatus.FOUND);
      return;
    }

    // Success path requires both `code` and `state` (CallbackQuerySchema enforces this,
    // but narrow once more for TS since the union allows `code` undefined on error path).
    if (query.code === undefined) {
      await reply.redirect('/login?oauth=error&reason=missing_code', HttpStatus.FOUND);
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(query.code, query.state);
      await this.routeCallbackResult(result, req, reply);
    } catch (error: unknown) {
      // State replay, expired state, malformed id_token, duplicate signup (R3) etc.
      // All HttpExceptions surface their status; unexpected errors collapse to generic.
      const status =
        error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.warn(`OAuth callback failed (HTTP ${status}): ${getErrorMessage(error)}`);
      // Discriminate on the exception class the service actually throws
      // (oauth.service.ts:226 — `throw new ConflictException(...)` on R3 duplicate
      // signup). `instanceof` matches the service contract directly and avoids
      // comparing a `number` to `HttpStatus.CONFLICT`, which would trip
      // `@typescript-eslint/no-unsafe-enum-comparison`.
      const reason = error instanceof ConflictException ? 'already_linked' : 'callback_failed';
      await reply.redirect(`/login?oauth=error&reason=${reason}`, HttpStatus.FOUND);
    }
  }

  /**
   * GET /auth/oauth/microsoft/signup-ticket/:id  (Plan §5.4)
   *
   * Peek-at-ticket — used by the SSR load of `/signup/oauth-complete` to
   * pre-fill the form with the OAuth-provided email and display name.
   * Non-consuming: the ticket stays in Redis and is only cleared by the
   * final POST /complete-signup (atomic GETDEL server-side).
   *
   * Returns 404 when the ticket is missing or expired so the frontend can
   * show a clear "ticket expired, please restart" message rather than a
   * generic error. Rate-limited via AuthThrottle (10 req / 5 min) to
   * prevent ticket-scraping from an attacker who guessed a ticket id.
   *
   * Only `email` + `displayName` are exposed — `providerUserId` and
   * `microsoftTenantId` stay server-side (see SignupTicketPreview comment).
   */
  @Get('signup-ticket/:id')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async getSignupTicket(@Param() params: TicketParamDto): Promise<SignupTicketPreview> {
    const preview = await this.oauthService.peekSignupTicket(params.id);
    if (preview === null) {
      throw new NotFoundException('Signup ticket is invalid or expired');
    }
    return preview;
  }

  /**
   * POST /auth/oauth/microsoft/complete-signup
   *
   * Submits the company-details form together with the Redis signup-ticket.
   * Creates tenant + root admin + OAuth link in one transaction (R8 atomicity),
   * then immediately issues session cookies — the user lands on /dashboard
   * without a second password prompt.
   */
  @Post('complete-signup')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.CREATED)
  async completeSignup(
    @Body() dto: CompleteSignupDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<OAuthCompleteSignupResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);

    const signup = await this.oauthService.completeSignup(dto.ticket, dto, ipAddress, userAgent);

    // Auto-login the freshly created root admin so the SPA/SSR session begins
    // without a second round-trip. Uses the SAME cookie shape as password login.
    const session = await this.authService.loginWithVerifiedUser(
      signup.userId,
      signup.tenantId,
      OAUTH_LOGIN_METHOD,
      ipAddress,
      userAgent,
    );
    setAuthCookies(reply, session.accessToken, session.refreshToken);

    return {
      ...signup,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  /**
   * POST /auth/oauth/microsoft/link  — V2 placeholder (plan §2.6).
   * Retroactive linking of an existing password-admin to a Microsoft account
   * lives in the admin settings surface (V2). The stub exists so the Azure AD
   * app registration can already list the URL pattern.
   */
  @Post('link')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  linkStub(): { message: string } {
    return { message: 'OAuth link endpoint is reserved for V2. Not implemented.' };
  }

  /**
   * DELETE /auth/oauth/microsoft/link  — V2 placeholder (plan §2.6).
   */
  @Delete('link')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  unlinkStub(): { message: string } {
    return { message: 'OAuth unlink endpoint is reserved for V2. Not implemented.' };
  }

  // === private helpers =====================================================

  /**
   * Translate the OAuthService.CallbackResult discriminated union into the
   * three happy-path redirects. Cookies are only set on `login-success`.
   */
  private async routeCallbackResult(
    result: Awaited<ReturnType<OAuthService['handleCallback']>>,
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (result.mode === 'login-success') {
      const { ipAddress, userAgent } = getClientInfo(req);
      const session = await this.authService.loginWithVerifiedUser(
        result.userId,
        result.tenantId,
        OAUTH_LOGIN_METHOD,
        ipAddress,
        userAgent,
      );
      setAuthCookies(reply, session.accessToken, session.refreshToken);
      // Delegate role-routing to SvelteKit — `/login` load-function detects the
      // just-set session cookie, calls `/users/me`, and redirects to the
      // role-specific dashboard (`/root-dashboard` / `/admin-dashboard` / etc.).
      // See frontend/src/routes/login/+page.server.ts `load` fn.
      // Previously hard-coded `/dashboard` which does not exist as a SvelteKit
      // route — every OAuth re-login 404'd before bouncing through /login.
      await reply.redirect('/login', HttpStatus.FOUND);
      return;
    }
    if (result.mode === 'login-not-linked') {
      await reply.redirect('/login?oauth=not-linked', HttpStatus.FOUND);
      return;
    }
    if (result.mode === 'signup-continue') {
      await reply.redirect(
        `/signup/oauth-complete?ticket=${encodeURIComponent(result.ticket)}`,
        HttpStatus.FOUND,
      );
      return;
    }
    // `provider-error` branch — should be pre-handled by the `query.error` check
    // in callback() before handleCallback() runs. Keep a safety net redirect.
    const reason = sanitiseErrorReason(result.reason);
    await reply.redirect(`/login?oauth=error&reason=${reason}`, HttpStatus.FOUND);
  }
}
