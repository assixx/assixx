/**
 * Users Module
 *
 * Handles user management for the application.
 * Provides CRUD operations, profile management, and availability tracking.
 *
 * NOTE: Availability logic split into UserAvailabilityService for separation of concerns
 */
import { Module } from '@nestjs/common';

import { HierarchyPermissionModule } from '../hierarchy-permission/hierarchy-permission.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { OrganigramModule } from '../organigram/organigram.module.js';
import { UserAvailabilityService } from './user-availability.service.js';
import { UserProfileService } from './user-profile.service.js';
import { UsersPermissionRegistrar } from './users-permission.registrar.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [ScopeModule, HierarchyPermissionModule, OrganigramModule],
  controllers: [UsersController],
  providers: [UsersPermissionRegistrar, UserAvailabilityService, UserProfileService, UsersService],
  exports: [UsersService, UserAvailabilityService, UserProfileService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class UsersModule {}
