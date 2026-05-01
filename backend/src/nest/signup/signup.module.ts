/**
 * Signup Module
 *
 * Handles tenant self-service registration.
 * All endpoints are public (no authentication required).
 */
import { Module, forwardRef } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
// 2FA email gate — Step 2.5 (ADR-054). After Step 2.7 added the
// TwoFactorAuthController → OAuthHandoffService edge (apex→subdomain handoff),
// the indirect cycle SignupModule → TwoFactorAuthModule → OAuthModule →
// SignupModule emerged (OAuthModule already imports SignupModule for
// `SignupService.registerTenantWithOAuth`). `forwardRef` on this edge breaks
// the cycle without touching the established AuthModule ↔ OAuthModule pair.
// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Step 2.7)
import { TwoFactorAuthModule } from '../two-factor-auth/two-factor-auth.module.js';
import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  // DomainsModule provides `DomainVerificationService` — needed by
  // SignupService to generate the `verification_token` for the
  // `tenant_domains(pending)` seed on password signup (§2.8) and
  // `tenant_domains(verified)` seed on OAuth signup (§2.8b).
  imports: [DomainsModule, forwardRef(() => TwoFactorAuthModule)],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SignupModule {}
