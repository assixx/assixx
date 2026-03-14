/**
 * User Feature Permissions Module
 *
 * Provides per-user feature permission management endpoints.
 * Depends on DatabaseModule (for DB access) and PermissionRegistryModule (Global).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Module } from '@nestjs/common';

import { HierarchyPermissionModule } from '../hierarchy-permission/hierarchy-permission.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { UserPermissionsController } from './user-permissions.controller.js';
import { UserPermissionsService } from './user-permissions.service.js';

@Module({
  imports: [ScopeModule, HierarchyPermissionModule],
  controllers: [UserPermissionsController],
  providers: [UserPermissionsService],
  exports: [UserPermissionsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class UserPermissionsModule {}
