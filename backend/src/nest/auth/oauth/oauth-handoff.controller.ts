/**
 * OAuth Handoff Controller — provider-agnostic session bridge for subdomain
 * OAuth flows (ADR-050 §OAuth, masterplan §Step 2.5f).
 *
 * Why its own controller (not a sibling method on OAuthController):
 *   OAuthController is prefixed `auth/oauth/microsoft` (provider-scoped).
 *   The handoff endpoint is deliberately provider-agnostic — when V2 adds
 *   Google/Apple, the same `/auth/oauth/handoff` URL consumes tokens from
 *   all providers. Provider-agnostic URL means provider-agnostic controller.
 *
 * Security surface:
 *   - Public endpoint (no JwtAuthGuard — that's what it's about to mint).
 *   - Throttled like all auth endpoints (CustomThrottlerGuard + AuthThrottle).
 *   - `TenantHostResolverMiddleware` (app.module.ts global) has already
 *     populated `req.hostTenantId` by the time this handler runs — the
 *     handoff service consumes that value for the R15 host-cross-check.
 *   - Token validated at the DTO layer (hex regex) before any Redis hit.
 *
 * Response shape:
 *   Returns the auth payload as JSON. The SvelteKit subdomain page at
 *   `/signup/oauth-complete` receives the JSON in its SSR load function
 *   and calls `cookies.set(...)` on ITS OWN response so the browser stores
 *   the session cookies scoped to the subdomain origin. Keeping cookie
 *   authoring in SvelteKit centralises the cookie-shape knowledge on the
 *   frontend side, mirroring how the password-login flow already works.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §OAuth
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.5f
 */
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators/public.decorator.js';
import { AuthThrottle } from '../../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../../common/guards/throttler.guard.js';
import type { HostAwareRequest } from '../../common/middleware/tenant-host-resolver.middleware.js';
import { HandoffBodyDto } from './dto/index.js';
import { OAuthHandoffService } from './oauth-handoff.service.js';

/** Shape returned to the SvelteKit subdomain page. */
interface OAuthHandoffResponse {
  accessToken: string;
  refreshToken: string;
  userId: number;
  tenantId: number;
}

@Controller('auth/oauth')
export class OAuthHandoffController {
  constructor(private readonly handoffService: OAuthHandoffService) {}

  @Post('handoff')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async consume(
    @Body() dto: HandoffBodyDto,
    @Req() req: FastifyRequest,
  ): Promise<OAuthHandoffResponse> {
    // `hostTenantId` is populated by TenantHostResolverMiddleware (app.module.ts,
    // mounted globally). Read via `req.raw` — the middleware runs under
    // `@fastify/middie` which operates on the raw IncomingMessage; the
    // Fastify wrapper exposes it as `.raw`. Reading `req.hostTenantId`
    // directly would silently be `undefined` (Session 10 / D17 discovery).
    //
    // On apex or unknown host it is null — the handoff service then throws
    // HANDOFF_HOST_MISMATCH (correct: the subdomain origin is the ONLY valid
    // consumer of a handoff token).
    const hostTenantId = (req as HostAwareRequest).raw.hostTenantId ?? null;
    const payload = await this.handoffService.consume(dto.token, hostTenantId);
    return {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      userId: payload.userId,
      tenantId: payload.tenantId,
    };
  }
}
