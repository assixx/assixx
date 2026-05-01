/**
 * Auth Module
 *
 * Handles authentication for the application.
 * Provides login, logout, token refresh, user registration, and connection tickets.
 *
 * Dependencies:
 * - DatabaseModule (for user queries)
 * - JwtModule (for token operations)
 * - ConfigModule (for Redis configuration)
 */
import { Module, forwardRef } from '@nestjs/common';

import { MailerService } from '../common/services/mailer.service.js';
import { DomainsModule } from '../domains/domains.module.js';
// 2FA email gate — Step 2.4 / 2.7 (ADR-054). Bidirectional cycle:
//   - AuthModule → TwoFactorAuthModule: `TwoFactorAuthService.issueChallenge`
//     in `AuthService.login` (Step 2.4).
//   - TwoFactorAuthModule → AuthModule: `TwoFactorAuthController.verify`
//     calls `AuthService.loginWithVerifiedUser` for token issuance and
//     `OAuthHandoffService.mint` for the apex→subdomain handoff (Step 2.7).
// Both edges use `forwardRef` per the canonical NestJS circular-dep pattern
// (https://docs.nestjs.com/fundamentals/circular-dependency); mirrors the
// `AuthModule ↔ OAuthModule` pair below.
// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Step 2.7)
import { TwoFactorAuthModule } from '../two-factor-auth/two-factor-auth.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConnectionTicketService } from './connection-ticket.service.js';
// OAuth sign-in (V1: Microsoft only) — see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md
// forwardRef: OAuthController injects AuthService (loginWithVerifiedUser) → OAuthModule
// needs to import AuthModule back, which is the canonical circular-dep scenario
// (NestJS docs: https://docs.nestjs.com/fundamentals/circular-dependency). Spec D15.
// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Spec Deviation D15)
import { OAuthModule } from './oauth/oauth.module.js';

@Module({
  // DomainsModule provides `TenantVerificationService` — required by
  // `AuthService.createUser` per §2.9 + D33 Option (a) KISS gate.
  // TwoFactorAuthModule provides `TwoFactorAuthService` (issueChallenge in
  // `AuthService.login`, Step 2.4) AND consumes AuthService back via the
  // verify controller (Step 2.7) — `forwardRef` on both sides per the
  // documented circular-dep pattern (see import comment above).
  imports: [forwardRef(() => OAuthModule), DomainsModule, forwardRef(() => TwoFactorAuthModule)],
  controllers: [AuthController],
  providers: [AuthService, ConnectionTicketService, MailerService],
  exports: [AuthService, ConnectionTicketService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AuthModule {}
