/**
 * Users Module
 *
 * Handles user management for the application.
 * Provides CRUD operations, profile management, and availability tracking.
 *
 * NOTE: Availability logic split into UserAvailabilityService for separation of concerns
 */
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MailerService } from '../common/services/mailer.service.js';
import { DomainsModule } from '../domains/domains.module.js';
import { HierarchyPermissionModule } from '../hierarchy-permission/hierarchy-permission.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { OrganigramModule } from '../organigram/organigram.module.js';
import { RootModule } from '../root/root.module.js';
import { SecuritySettingsModule } from '../security-settings/security-settings.module.js';
import { TwoFactorAuthModule } from '../two-factor-auth/two-factor-auth.module.js';
import { EmailChangeController } from './email-change.controller.js';
import { EmailChangeService } from './email-change.service.js';
import { UserAvailabilityService } from './user-availability.service.js';
import { UserProfileService } from './user-profile.service.js';
import { UsersPermissionRegistrar } from './users-permission.registrar.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  // DomainsModule provides `TenantVerificationService` — required by
  // `UsersService.insertUserRecord` per §2.9 KISS gate (§0.2.5 #1).
  // SecuritySettingsModule provides `SecuritySettingsService` — required
  // by `UserProfileService.changePassword` to enforce the tenant-wide
  // "allow user password change" policy (ADR-045 Layer-1 gate).
  imports: [
    ScopeModule,
    HierarchyPermissionModule,
    OrganigramModule,
    DomainsModule,
    SecuritySettingsModule,
    // AuthModule provides `AuthService` — required by
    // `UsersController.sendPasswordResetLink` for Root-initiated password-reset
    // flow (ADR-051 §2.7). Credential-issuance stays in Auth-domain even
    // though the HTTP route shape lives under /users. AuthModule already
    // exports AuthService; no circular dep (auth/* never references Users).
    AuthModule,
    // RootModule provides `RootProtectionService` — required by
    // `UsersService.deleteUser` (Layer-2 cross-root + last-root guard, see
    // FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.3, Session 4). RootModule
    // imports Organigram/TenantDeletion/Domains; none of them reference Users
    // → no circular dep.
    RootModule,
    // Step 2.12 (DD-32 / R15): EmailChangeService consumes TwoFactorAuthService
    // (issueChallenge × 2 + verifyChallengePreCommit × 2) and TwoFactorCodeService
    // (consumeChallenge for anti-persistence DEL on failure). One-way edge —
    // TwoFactorAuthModule has no back-reference to UsersModule, so no
    // forwardRef needed. MailerService for the suspicious-activity mail on
    // verify failure is provided locally below per the project convention
    // (see auth.module.ts:46, two-factor-auth.module.ts:108).
    TwoFactorAuthModule,
  ],
  controllers: [UsersController, EmailChangeController],
  providers: [
    UsersPermissionRegistrar,
    UserAvailabilityService,
    UserProfileService,
    UsersService,
    EmailChangeService,
    MailerService,
  ],
  exports: [UsersService, UserAvailabilityService, UserProfileService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class UsersModule {}
