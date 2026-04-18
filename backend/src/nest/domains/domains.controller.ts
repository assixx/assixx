/**
 * Domains Controller — HTTP endpoints for tenant domain management.
 *
 * Route prefix `/api/v2/domains` via the global prefix set in `main.ts`.
 * All endpoints are root-only (§0.2.5 #8) — admins and employees have zero
 * visibility or action. The single exception is `GET /verification-status`
 * which is also available to admins (§0.2.5 #16) so the frontend banner can
 * surface the correct UI state on every `(app)/+layout.server.ts` load.
 *
 * NONE of these endpoints call `assertTenantVerified()` — domain management
 * is exactly the action that unlocks verification; gating it would deadlock
 * the tenant (§2.7).
 *
 * Throttling is endpoint-specific (see §2.7 table). `POST /:id/verify` uses
 * the new `domain-verify` tier (10 req / 10 min, registered in
 * `AppThrottlerModule`) to bound outbound DNS — every other endpoint uses
 * `@UserThrottle()` (1000 / 15 min).
 *
 * Guards: Global `JwtAuthGuard` + `RolesGuard` are active via `APP_GUARD`
 * (app.module.ts) — no class-level `@UseGuards(...)` needed. The global
 * `ZodValidationPipe` validates `@Body()` and `@Param()` against the DTO
 * schemas (Zod-Integration-Guide §5).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.7
 * @see docs/infrastructure/adr/ADR-048-tenant-domain-verification.md (pending Phase 6)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { DomainVerifyThrottle, UserThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import { DomainsService } from './domains.service.js';
import type { TenantDomain } from './domains.types.js';
import { AddDomainDto, DomainIdParamDto } from './dto/index.js';
import { TenantVerificationService } from './tenant-verification.service.js';

/** Shape of `GET /domains/verification-status`. §0.2.5 #16. */
interface VerificationStatusResponse {
  verified: boolean;
}

// Class-level `CustomThrottlerGuard` so `@UserThrottle()` + `@DomainVerifyThrottle()`
// actually apply (ADR-001 + app.module.ts §196-200: "Throttler Guard is NOT global
// — applied selectively via decorators"). Without this, the @*Throttle decorators
// are no-ops because the guard never runs — discovered by Phase 4 API tests when
// the `domain-verify` 10/10min cap didn't trip after 15 rapid /verify calls.
// Matches the wiring pattern in AuthController, OAuthController, LogsController,
// SignupController, E2eKeysController, E2eEscrowController.
@Controller('domains')
@UseGuards(CustomThrottlerGuard)
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly tenantVerification: TenantVerificationService,
  ) {}

  /**
   * `GET /domains` — list the tenant's domains (primary-first, created-at ASC).
   * Root-only; admins / employees get 403.
   */
  @Get()
  @Roles('root')
  @UserThrottle()
  async list(@TenantId() tenantId: number): Promise<TenantDomain[]> {
    return await this.domainsService.listForTenant(tenantId);
  }

  /**
   * `POST /domains` — add a new domain with `status='pending'`. Response
   * includes `verificationInstructions` (TXT host + value) ONLY on this
   * immediate add-response per §0.2.5 #10; subsequent list/verify/patch
   * responses never re-expose the token.
   */
  @Post()
  @Roles('root')
  @UserThrottle()
  @HttpCode(HttpStatus.CREATED)
  async add(@TenantId() tenantId: number, @Body() dto: AddDomainDto): Promise<TenantDomain> {
    return await this.domainsService.addDomain(tenantId, dto.domain);
  }

  /**
   * `POST /domains/:id/verify` — trigger a DNS TXT lookup; if the stored
   * token matches, flip the row to `status='verified'`. Idempotent on
   * already-verified rows. Uses the tight `domain-verify` throttle tier
   * (10 req / 10 min) because this is the only endpoint emitting outbound
   * DNS — protects upstream resolvers + defends R11.
   */
  @Post(':id/verify')
  @Roles('root')
  @DomainVerifyThrottle()
  async verify(
    @TenantId() tenantId: number,
    @Param() params: DomainIdParamDto,
  ): Promise<TenantDomain> {
    return await this.domainsService.triggerVerify(tenantId, params.id);
  }

  /**
   * `PATCH /domains/:id/primary` — mark the domain as the tenant's primary.
   * Two-statement transaction inside the service clears any existing primary
   * first (partial UNIQUE index `tenant_domains_one_primary_per_tenant`).
   * Returns 204 No Content.
   */
  @Patch(':id/primary')
  @Roles('root')
  @UserThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPrimary(@TenantId() tenantId: number, @Param() params: DomainIdParamDto): Promise<void> {
    await this.domainsService.setPrimary(tenantId, params.id);
  }

  /**
   * `DELETE /domains/:id` — soft-delete (row stays at `is_active=DELETED`
   * for audit trail). Losing the last verified domain re-locks user-creation
   * via `assertVerified()`; existing users stay operational (v0.3.4 D27
   * graceful-degradation rule). Returns 204 No Content.
   */
  @Delete(':id')
  @Roles('root')
  @UserThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: number, @Param() params: DomainIdParamDto): Promise<void> {
    await this.domainsService.removeDomain(tenantId, params.id);
  }

  /**
   * `GET /domains/verification-status` — lightweight `{ verified: boolean }`
   * for the banner on `(app)/+layout.server.ts` + user-creation form guards
   * (§0.2.5 #16, Q8). Admins also allowed so they can surface the correct
   * UI state before the first verification lands.
   */
  @Get('verification-status')
  @Roles('root', 'admin')
  @UserThrottle()
  async getVerificationStatus(@TenantId() tenantId: number): Promise<VerificationStatusResponse> {
    return { verified: await this.tenantVerification.isVerified(tenantId) };
  }
}
