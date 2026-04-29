/**
 * Auth Controller
 *
 * HTTP endpoints for authentication:
 * - POST /auth/login    - User login (public)
 * - POST /auth/register - Register new user (admin/root only)
 * - POST /auth/logout   - User logout (authenticated)
 * - POST /auth/refresh  - Refresh access token (public)
 * - GET  /auth/verify   - Verify current token (authenticated)
 * - GET  /auth/me       - Get current user (authenticated)
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AuthThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
// 2FA challenge cookie config — Step 2.4 (ADR-054). `CODE_TTL_SEC` keeps the
// cookie's `Max-Age` in lockstep with the Redis-side challenge TTL, so a
// stale cookie can never outlive its underlying record.
import { CODE_TTL_SEC } from '../two-factor-auth/two-factor-auth.constants.js';
import type { LoginResultBody } from '../two-factor-auth/two-factor-auth.types.js';
import { AuthService } from './auth.service.js';
import { ConnectionTicketService } from './connection-ticket.service.js';
import {
  ConnectionTicketDto,
  ForgotPasswordDto,
  HandoffMintDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/index.js';
import type {
  ConnectionTicketResponse,
  ForgotPasswordResponse,
  HandoffMintResponse,
  RefreshResponse,
  ResetPasswordResponse,
} from './dto/index.js';
// Session 12c (ADR-050): reuse the handoff machinery from OAuth (Session 7)
// for password-login → subdomain redirect. OAuthModule already exports this
// service; AuthModule already imports OAuthModule (forwardRef, D15).
import { OAuthHandoffService } from './oauth/oauth-handoff.service.js';

/**
 * Cookie configuration for SSR support
 * httpOnly: Prevents XSS attacks (JavaScript cannot read the cookie)
 * secure: Only sent over HTTPS (disabled in dev for localhost)
 * sameSite: CSRF protection
 * path: Cookie available for all routes
 *
 * Exported so OAuthController (sibling module under `auth/oauth/`) can reuse
 * the exact same cookie shape on its login-success + complete-signup paths —
 * SSR clients must see identical cookies regardless of authentication method
 * (plan §2.6). Do not duplicate these values anywhere else.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Set-Cookie Max-Age is SECONDS per RFC 6265; cookie@1.x writes it 1:1.
  // Previous `30 * 60 * 1000` produced `Max-Age=1800000` → ~20.83 days of
  // browser persistence, so cookies lingered long after the JWT inside
  // expired. That masked real logout/session bugs and leaked state between
  // sessions on shared browsers. (2026-04-17)
  maxAge: 30 * 60,
};

/**
 * Refresh token cookie configuration - STRICTER than access token
 * sameSite: 'strict' - Only sent for same-site requests (better CSRF protection)
 * path: '/api/v2/auth' - Only sent to auth endpoints (minimizes exposure)
 *
 * SECURITY: Refresh tokens are long-lived (7 days) and must be protected.
 * By limiting the path, the cookie is NOT sent for regular API requests,
 * reducing the attack surface for CSRF.
 *
 * Exported for reuse by OAuthController — see COOKIE_OPTIONS comment above.
 */
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  path: '/api/v2/auth',
  // Seconds per RFC 6265 — see COOKIE_OPTIONS note. Previous value was
  // 1000× the intended 7 days (~19 years). (2026-04-17)
  maxAge: 7 * 24 * 60 * 60,
};

/**
 * Expiry-only companion cookie — exposes ONLY the Unix timestamp (seconds
 * since epoch) of the access token's `exp` claim so client-side JS can render
 * the session-countdown UI without ever holding the JWT itself.
 *
 * `httpOnly: false` is intentional and safe: the payload is a non-sensitive
 * integer. No key material leaks, no authenticated action is possible with
 * just an exp value. All other attributes mirror COOKIE_OPTIONS so the cookie
 * lives and dies with the access token.
 *
 * Why we need this — problem solved:
 *   Every OAuth login-success flow is a browser-following-302 from the
 *   backend. That path has no JSON response body to hydrate a client-side
 *   TokenManager, so the classic "decode JWT in localStorage to get exp"
 *   trick fails — the timer widget rendered "00:00 / expired" immediately
 *   after a fresh login. Password login didn't hit this because its form
 *   action returns JSON that includes the token. This cookie unifies both
 *   auth methods: backend always sets the exp cookie, frontend always reads
 *   it; auth method becomes irrelevant to the UI.
 *
 * @see ADR-046 OAuth Sign-In (2026-04-16 amendment — tokenExp-cookie pattern)
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md Phase 6 post-mortem
 */
export const EXP_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Seconds per RFC 6265 — see COOKIE_OPTIONS note. Mirrors access token's
  // 30-min lifetime so the companion cookie dies with the JWT. (2026-04-17)
  maxAge: 30 * 60,
};

/**
 * Decode a JWT without verifying the signature and return its `exp` claim
 * (seconds since Unix epoch). Caller is trusted (we just minted the token
 * via our own signing service) so there is no need to re-verify.
 *
 * Throws if the token is malformed or missing `exp` — both are internal
 * invariants of our token issuer; violation is a bug, not a runtime error.
 */
function extractJwtExp(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (expected 3 dot-separated parts)');
  }
  const payloadPart = parts[1];
  if (payloadPart === undefined || payloadPart === '') {
    throw new Error('Invalid JWT payload segment');
  }
  const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const exp = payload['exp'];
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('JWT missing numeric exp claim');
  }
  return exp;
}

/**
 * Atomically set the three session cookies on any successful auth event.
 * This is the ONLY place that writes these three cookies — the 3-cookie
 * invariant (access + refresh + exp, or none) is enforced by centralising
 * the write path here. Every auth entry point (password login, refresh,
 * OAuth login-success, OAuth complete-signup) MUST call this helper.
 *
 * Exported so `OAuthController` (sibling module) can reuse without duplicating.
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
): void {
  reply.setCookie('accessToken', accessToken, COOKIE_OPTIONS);
  reply.setCookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  reply.setCookie('accessTokenExp', String(extractJwtExp(accessToken)), EXP_COOKIE_OPTIONS);
}

/**
 * Clear all three session cookies. Paths MUST mirror `setAuthCookies` /
 * `COOKIE_OPTIONS` / `REFRESH_COOKIE_OPTIONS` exactly — otherwise the
 * clearCookie call is a no-op (browser keeps the cookie) which leads to
 * phantom-session bugs that are miserable to debug.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie('accessToken', { path: '/' });
  reply.clearCookie('refreshToken', { path: '/api/v2/auth' });
  reply.clearCookie('accessTokenExp', { path: '/' });
}

/**
 * 2FA challenge cookie configuration — Step 2.4 (ADR-054).
 *
 * Holds the opaque base64url challenge token (~43 chars from 32 random bytes,
 * DD-4) between `POST /auth/login` and `POST /auth/2fa/verify`. R8 mitigation:
 * the token NEVER appears in the response body — controllers read it from the
 * cookie on verify. R14 mitigation: the cookie is set + read on the SAME
 * origin (no cross-subdomain traversal) — apex login on apex, tenant login
 * on tenant subdomain.
 *
 * `httpOnly: true` keeps the token out of JS reach (XSS can't lift it).
 * `secure` mirrors the access-cookie pattern (HTTPS-only in prod).
 * `sameSite: 'lax'` allows the cookie on the 303 redirect to /login/verify
 * but blocks cross-site fetches (CSRF defence on top of the throttler).
 * `path: '/'` so both /api/v2/auth/login (set) and /api/v2/auth/2fa/verify
 * (read) paths receive it.
 * `maxAge: CODE_TTL_SEC` keeps the cookie in lockstep with the Redis-side
 * challenge record so a stale cookie can never outlive its backing state.
 *
 * Exported so a future apex-signup form action (Step 2.5 / 5.4) can write
 * the same shape on its own success branch.
 */
export const CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: CODE_TTL_SEC,
};

/**
 * Atomically write the challenge cookie. Single-call helper so any future
 * caller (signup form action, e-mail-change flow per Step 2.12) writes the
 * exact same shape — divergence here would leak the cookie across paths it
 * shouldn't reach.
 */
export function setChallengeCookie(reply: FastifyReply, challengeToken: string): void {
  reply.setCookie('challengeToken', challengeToken, CHALLENGE_COOKIE_OPTIONS);
}

/**
 * Rotate ONLY the access token + its exp-companion cookie. The refresh token
 * cookie is left untouched — the session identity is unchanged, only a JWT
 * claim (`activeRole`) is being updated.
 *
 * Used by role-switch endpoints, which mint a new access token carrying the
 * switched `activeRole` claim. Without this helper the backend would return
 * the new token in JSON only, leaving the cookie state stuck at the old
 * role. That produces a cookie-vs-localStorage split-brain: SSR layout
 * reads the stale cookie and renders the old role while client-side Bearer
 * calls see the new one. The split silently "worked" for password login
 * (full-page reload after redirect re-hydrated everything from localStorage)
 * but surfaced immediately for OAuth users and for any SSR-first render.
 *
 * Exported so `RoleSwitchController` (sibling module) can call it without
 * duplicating the 2-cookie write + `extractJwtExp` decode dance.
 *
 * @see ADR-046 OAuth Sign-In (2026-04-16 amendment — role-switch cookie sync)
 */
export function rotateAccessCookies(reply: FastifyReply, newAccessToken: string): void {
  reply.setCookie('accessToken', newAccessToken, COOKIE_OPTIONS);
  reply.setCookie('accessTokenExp', String(extractJwtExp(newAccessToken)), EXP_COOKIE_OPTIONS);
}

/**
 * Response type for register endpoint
 */
interface RegisterResponse {
  id: number;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: number;
  createdAt: Date;
}

/**
 * Response type for logout endpoint
 */
interface LogoutResponse {
  message: string;
  tokensRevoked: number;
}

/**
 * Response type for verify endpoint
 */
interface VerifyResponse {
  valid: boolean;
  user: Partial<NestAuthUser>;
}

/**
 * Response type for getCurrentUser endpoint
 */
interface CurrentUserResponse {
  id: number;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: number;
  isActive: number;
  lastLogin: Date | null;
  createdAt: Date;
}

/**
 * Extract client info from request
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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly connectionTicketService: ConnectionTicketService,
    // Session 12c (ADR-050): apex-login → subdomain-handoff mint path.
    // OAuthHandoffService already mints the same payload shape; reusing it
    // keeps one Redis keyspace + one consumer endpoint for both login paths.
    private readonly handoffService: OAuthHandoffService,
  ) {}

  /**
   * POST /auth/login
   * Authenticate user with email + password and route into the 2FA email gate
   * (Step 2.4 / ADR-054).
   *
   * Two response shapes via the `LoginResult` discriminated union:
   *
   * - `stage: 'challenge_required'` (the only branch reachable today under
   *   v0.5.0 / DD-10 removed): credentials valid → 2FA code emailed → an
   *   httpOnly+Secure+SameSite=Lax cookie carries the opaque challenge token
   *   to the verify endpoint. The token is intentionally stripped from the
   *   response body (R8) — the body returns only the public challenge view
   *   (`expiresAt`, `resendAvailableAt`, `resendsRemaining`).
   *
   * - `stage: 'authenticated'` (currently unreachable from `/auth/login`):
   *   left as a compile-time exhaustiveness branch so a future per-tenant
   *   2FA-skip flag (V2) can re-enter the legacy 3-cookie tokens-in-body
   *   shape without re-typing the controller.
   *
   * The previous `setAuthCookies` call moves to the verify endpoint
   * (Step 2.7) — only an authenticated user (post-2FA) gets the access /
   * refresh / accessTokenExp triad written.
   */
  @Post('login')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle() // 10 requests per 5 minutes - brute force protection
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResultBody> {
    const result = await this.authService.login(dto);

    if (result.stage === 'challenge_required') {
      const { challengeToken, expiresAt, resendAvailableAt, resendsRemaining } = result.challenge;
      setChallengeCookie(reply, challengeToken);
      return {
        stage: 'challenge_required',
        challenge: { expiresAt, resendAvailableAt, resendsRemaining },
      };
    }

    // 'authenticated' branch — unreachable from /auth/login under v0.5.0
    // (every password login issues a challenge). Kept for compile-time
    // exhaustiveness; if a future change re-introduces a 2FA-skip path,
    // this branch writes the same 3-cookie triad as the legacy flow.
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return result;
  }

  /**
   * POST /auth/handoff/mint — single-use token for apex-login → subdomain redirect.
   *
   * Called by the frontend login action (`(public)/login/+page.server.ts`)
   * when the user authenticated on the apex (`locals.hostSlug === null`)
   * but their tenant has a subdomain. We mint a 32-byte opaque token into
   * the SAME Redis keyspace the OAuth handoff uses (`oauth:handoff:{token}`,
   * 60 s TTL) carrying the exact auth payload. The subdomain's
   * `/signup/oauth-complete?token=X` page (Session 12) consumes it,
   * performs the R15 host-cross-check, and sets cookies on its own origin.
   *
   * Security model:
   *   - Bearer-authenticated (JwtAuthGuard): only a user who just logged in
   *     on the apex can mint — nothing new accessible that their accessToken
   *     doesn't already grant.
   *   - Throttled via AuthThrottle() — same brute-force defence as /login.
   *   - 404 when the tenant has no subdomain (greenfield: can't happen for
   *     new signups because the DTO requires it; defensive regardless).
   *
   * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §OAuth (handoff reuse)
   * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Session 12c
   */
  @Post('handoff/mint')
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async mintHandoff(
    @Body() dto: HandoffMintDto,
    @CurrentUser() user: NestAuthUser,
    @Req() req: FastifyRequest,
  ): Promise<HandoffMintResponse> {
    // The Bearer token header IS the accessToken we want to bake into the
    // handoff payload. No need to derive it from anywhere else.
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (accessToken === '') {
      // Shouldn't happen under JwtAuthGuard, but defensive: reject with the
      // same error code the guard would produce downstream.
      throw new NotFoundException({
        code: 'HANDOFF_MINT_MISSING_ACCESS_TOKEN',
        message: 'Access token required in Authorization header.',
      });
    }

    const subdomain = await this.authService.getSubdomainForTenant(user.tenantId);
    if (subdomain === null) {
      // Defensive: greenfield prod tenants always have a subdomain (signup
      // DTO enforces). If we hit this, something is off with the tenant row
      // — caller can't redirect to a subdomain that doesn't exist.
      throw new NotFoundException({
        code: 'HANDOFF_MINT_NO_SUBDOMAIN',
        message: 'Tenant has no subdomain configured.',
      });
    }

    const token = await this.handoffService.mint({
      userId: user.id,
      tenantId: user.tenantId,
      accessToken,
      refreshToken: dto.refreshToken,
    });

    return { token, subdomain };
  }

  /**
   * POST /auth/register
   * Register a new user (admin/root only)
   */
  @Post('register')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<RegisterResponse> {
    const newUser = await this.authService.register(dto, user);

    // Return safe user data (exclude password)
    return {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: newUser.role,
      tenantId: newUser.tenant_id,
      createdAt: newUser.created_at,
    };
  }

  /**
   * POST /auth/logout
   * Logout user and revoke all refresh tokens
   *
   * Clears httpOnly cookies for SSR support.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: NestAuthUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LogoutResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);
    const result = await this.authService.logout(user, ipAddress, userAgent);

    // Clear all three session cookies (paths must mirror setAuthCookies).
    clearAuthCookies(reply);

    return {
      message: 'Logged out successfully',
      tokensRevoked: result.tokensRevoked,
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   *
   * Supports both:
   * - Cookie-based refresh (SSR): reads refreshToken from cookie if body is empty
   * - Body-based refresh (SPA): uses refreshToken from request body
   *
   * Updates httpOnly cookies with new tokens for SSR support.
   */
  @Post('refresh')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle() // 10 requests per 5 minutes - prevent token refresh abuse
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);

    // Support cookie-based refresh for SSR: use cookie if body is empty
    // Explicit empty string check for strict-boolean-expressions compliance
    const refreshToken =
      dto.refreshToken !== '' ? dto.refreshToken : (req.cookies['refreshToken'] ?? '');
    const effectiveDto: RefreshDto = { refreshToken };

    const result = await this.authService.refresh(effectiveDto, ipAddress, userAgent);

    // Rotate all three session cookies together — new access token means a
    // new exp, and refresh rotation invalidates the old refresh cookie.
    setAuthCookies(reply, result.accessToken, result.refreshToken);

    return result;
  }

  /**
   * GET /auth/verify
   * Verify current access token is valid
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() user: NestAuthUser): VerifyResponse {
    return this.authService.verifyToken(user);
  }

  /**
   * GET /auth/me
   * Get current authenticated user information
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@CurrentUser() user: NestAuthUser): Promise<CurrentUserResponse> {
    const foundUser = await this.authService.getCurrentUser(user);

    // Return safe user data (exclude password, reset_token, etc.)
    return {
      id: foundUser.id,
      email: foundUser.email,
      username: foundUser.username,
      firstName: foundUser.first_name,
      lastName: foundUser.last_name,
      role: foundUser.role,
      tenantId: foundUser.tenant_id,
      isActive: foundUser.is_active,
      lastLogin: foundUser.last_login,
      createdAt: foundUser.created_at,
    };
  }

  /**
   * POST /auth/forgot-password
   * Request password reset email (public, rate-limited)
   *
   * SECURITY: Always returns same message regardless of whether email exists.
   * This prevents email enumeration attacks.
   */
  @Post('forgot-password')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle() // 10 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    // Additive response shape (ADR-051 §2.2 / Plan v0.4.4):
    //   - root happy path + silent-drop → `{ message }` (byte-identical → R1)
    //   - admin/employee blocked       → `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }`
    // The `message` string is canonical and identical across all three paths
    // so root vs silent-drop cannot be distinguished on the wire.
    const result = await this.authService.forgotPassword(dto);
    const message =
      'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.';
    if (result.blocked) {
      return { message, blocked: true, reason: 'ROLE_NOT_ALLOWED' };
    }
    return { message };
  }

  /**
   * POST /auth/reset-password
   * Reset password using token from email (public, rate-limited)
   */
  @Post('reset-password')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle() // 10 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    await this.authService.resetPassword(dto);

    return {
      message: 'Passwort erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.',
    };
  }

  /**
   * POST /auth/connection-ticket
   * Generate a short-lived, single-use ticket for WebSocket/SSE connections.
   *
   * SECURITY: This endpoint requires authentication (JWT in header/cookie).
   * The returned ticket is:
   * - Valid for 30 seconds
   * - Single-use (deleted after first use)
   * - Contains no sensitive data (just a random UUID)
   *
   * Use this ticket in WebSocket URL instead of JWT to prevent token leakage in logs.
   *
   * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
   */
  @Post('connection-ticket')
  @HttpCode(HttpStatus.OK)
  async createConnectionTicket(
    @Body() dto: ConnectionTicketDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ConnectionTicketResponse> {
    return await this.connectionTicketService.createTicket({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      activeRole: user.activeRole,
      purpose: dto.purpose,
      createdAt: Date.now(),
    });
  }
}
