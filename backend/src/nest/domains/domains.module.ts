/**
 * Domains Module
 *
 * NestJS module for tenant domain management and verification. Exports
 * `TenantVerificationService` so Users / Auth / Root / RootAdmin / DummyUsers
 * can inject it to gate user-creation paths behind `assertVerified()` — the
 * KISS "single helper, not a global guard" design (masterplan §0.2.5 #1).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.1
 * @see docs/infrastructure/adr/ADR-048-tenant-domain-verification.md (pending Phase 6)
 */
import { Module } from '@nestjs/common';

import { DomainVerificationService } from './domain-verification.service.js';
import { DomainsController } from './domains.controller.js';
import { DomainsService } from './domains.service.js';
import { TenantVerificationService } from './tenant-verification.service.js';

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, DomainVerificationService, TenantVerificationService],
  // Cross-module consumers (Step 2.6 + 2.8 + 2.8b + 2.9):
  //   - `TenantVerificationService` — KISS gate for user-creation services
  //     (UsersModule, AuthModule, RootModule, RootAdminModule, DummyUsersModule)
  //     to wire `assertVerified()` at every user-creation entry point.
  //   - `DomainVerificationService` — token generator for SignupModule's
  //     `tenant_domains(pending)` seed on password signup (§2.8) and
  //     `tenant_domains(verified)` seed on OAuth signup (§2.8b).
  exports: [TenantVerificationService, DomainVerificationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class DomainsModule {}
