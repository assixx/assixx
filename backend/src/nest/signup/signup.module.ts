/**
 * Signup Module
 *
 * Handles tenant self-service registration.
 * All endpoints are public (no authentication required).
 */
import { Module } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  // DomainsModule provides `DomainVerificationService` — needed by
  // SignupService to generate the `verification_token` for the
  // `tenant_domains(pending)` seed on password signup (§2.8) and
  // `tenant_domains(verified)` seed on OAuth signup (§2.8b).
  imports: [DomainsModule],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SignupModule {}
