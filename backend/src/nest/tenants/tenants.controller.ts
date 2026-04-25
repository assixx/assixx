/**
 * Tenants Controller — public branding endpoint for subdomain login pages.
 *
 * One endpoint only. Consumed by the frontend's `(public)/+layout.server.ts`
 * load function when `event.locals.hostSlug !== null` (i.e., request arrived
 * on `<slug>.assixx.com`). The response drives per-tenant page titles +
 * (in V2) logo / primary-color theming.
 *
 * Security posture:
 *   - `@Public()` — no JWT required. The login / signup / forgot-password
 *     pages must render before any credential exchange.
 *   - `@AuthThrottle()` — same rate-limit bucket as `/signup/check-subdomain`;
 *     public endpoints are an abuse vector (enumeration, DoS).
 *   - Null-brand response for unknown slugs (not 404) — prevents tenant
 *     enumeration via HTTP status (ADR-050 R4 rationale).
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';
import { AuthThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import { BrandingParamDto } from './dto/index.js';
import type { BrandingResponseData } from './dto/index.js';
import { TenantsService } from './tenants.service.js';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /api/v2/tenants/branding/:slug
   *
   * Returns the tenant's public branding fields or the null-brand sentinel
   * for unknown slugs. Always 200 — never 404 — to avoid leaking tenant
   * existence via status code.
   */
  @Get('branding/:slug')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async getBranding(@Param() params: BrandingParamDto): Promise<BrandingResponseData> {
    return await this.tenantsService.getBranding(params.slug);
  }
}
