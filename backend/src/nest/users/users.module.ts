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
import { DomainsModule } from '../domains/domains.module.js';
import { HierarchyPermissionModule } from '../hierarchy-permission/hierarchy-permission.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { OrganigramModule } from '../organigram/organigram.module.js';
import { SecuritySettingsModule } from '../security-settings/security-settings.module.js';
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
  ],
  controllers: [UsersController],
  providers: [UsersPermissionRegistrar, UserAvailabilityService, UserProfileService, UsersService],
  exports: [UsersService, UserAvailabilityService, UserProfileService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class UsersModule {}
