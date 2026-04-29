/**
 * Signup Controller
 *
 * HTTP endpoints for tenant self-service registration:
 * - POST /signup          - Register new tenant (public)
 * - GET  /signup/check-subdomain/:subdomain - Check subdomain availability (public)
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Step 2.5 (ADR-054): reuse the cookie-writing primitives from AuthController
// so password signup, password login, and OAuth handoff share ONE source of
// truth for cookie shape (`COOKIE_OPTIONS` / `CHALLENGE_COOKIE_OPTIONS`). A
// future divergence here would silently leak cookies across paths it should
// not reach. The controller-side helpers are already exported on the
// AuthController file for the same reason (OAuth reuse).
import { setAuthCookies, setChallengeCookie } from '../auth/auth.controller.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { LoginResultBody } from '../two-factor-auth/two-factor-auth.types.js';
import { CheckSubdomainParamDto, SignupDto } from './dto/index.js';
import type { SubdomainCheckResponseData } from './dto/index.js';
import { SignupService } from './signup.service.js';

/**
 * Extract client info from request for audit logging
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

@Controller('signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  /**
   * POST /signup
   * Register a new tenant with admin user (password path) and route into the
   * 2FA email gate (Step 2.5 / ADR-054).
   *
   * Creates a *pending* tenant + root user (`is_active = INACTIVE`) and emails
   * a 6-character Crockford-Base32 code to `dto.adminEmail`. The user must
   * pass `POST /auth/2fa/verify` (Step 2.7) before tokens are minted and the
   * row flips to `IS_ACTIVE.ACTIVE`.
   *
   * Two response shapes via the `LoginResultBody` discriminated union:
   *
   * - `stage: 'challenge_required'` (the only branch reachable today under
   *   v0.5.0 / DD-10 removed): challenge-token cookie is set; the body
   *   carries only the public challenge view (no token — R8). Frontend
   *   redirects to `/signup/verify` (Phase 5 Step 5.4).
   *
   * - `stage: 'authenticated'` — left for compile-time exhaustiveness so a
   *   future per-tenant 2FA-skip flag can re-enter the legacy 3-cookie
   *   tokens-in-body shape without re-typing the controller.
   *
   * Status remains 201 CREATED — the tenant + user *are* created at this
   * point; only the 2FA gate stands between the user and `is_active = 1`.
   * `ipAddress` / `userAgent` are still forwarded for the registration audit
   * row (`root_logs`) which is independent of the 2FA audit (§A8).
   */
  @Post()
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResultBody> {
    const { ipAddress, userAgent } = getClientInfo(req);
    const result = await this.signupService.registerTenant(dto, ipAddress, userAgent);

    if (result.stage === 'challenge_required') {
      const { challengeToken, expiresAt, resendAvailableAt, resendsRemaining } = result.challenge;
      setChallengeCookie(reply, challengeToken);
      return {
        stage: 'challenge_required',
        challenge: { expiresAt, resendAvailableAt, resendsRemaining },
      };
    }

    // 'authenticated' branch — unreachable from POST /signup under v0.5.0
    // (every password signup issues a challenge). Kept for compile-time
    // exhaustiveness; a future change re-introducing a 2FA-skip path would
    // write the same 3-cookie triad as login.
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return result;
  }

  /**
   * GET /signup/check-subdomain/:subdomain
   * Check if a subdomain is available for registration
   *
   * Returns:
   * - available: boolean
   * - subdomain: string
   * - error?: string (if subdomain format is invalid)
   */
  @Get('check-subdomain/:subdomain')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async checkSubdomain(
    @Param() params: CheckSubdomainParamDto,
  ): Promise<SubdomainCheckResponseData> {
    return await this.signupService.checkSubdomainAvailability(params.subdomain);
  }
}
