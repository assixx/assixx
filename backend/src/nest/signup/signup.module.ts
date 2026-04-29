/**
 * Signup Module
 *
 * Handles tenant self-service registration.
 * All endpoints are public (no authentication required).
 */
import { Module } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
// 2FA email gate — Step 2.5 (ADR-054). One-way edge: SignupModule depends on
// TwoFactorAuthModule (for `TwoFactorAuthService.issueChallenge` in
// `SignupService.registerTenant`); TwoFactorAuthModule has no edge back, so
// no `forwardRef` is needed here (mirrors `auth.module.ts:36`). OAuth signup
// (`SignupService.registerTenantWithOAuth`) does NOT call into this service
// — Azure AD is the trust boundary per DD-7.
import { TwoFactorAuthModule } from '../two-factor-auth/two-factor-auth.module.js';
import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  // DomainsModule provides `DomainVerificationService` — needed by
  // SignupService to generate the `verification_token` for the
  // `tenant_domains(pending)` seed on password signup (§2.8) and
  // `tenant_domains(verified)` seed on OAuth signup (§2.8b).
  imports: [DomainsModule, TwoFactorAuthModule],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SignupModule {}
