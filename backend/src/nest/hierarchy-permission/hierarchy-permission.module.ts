/**
 * Hierarchy Permission Module
 *
 * Provides HierarchyPermissionService for permission checks
 * with Area → Department → Team inheritance.
 * Registers manage_hierarchy permissions (ADR-020).
 */
import { Module } from '@nestjs/common';

import { HierarchyPermissionService } from './hierarchy-permission.service.js';
import { ManageHierarchyPermissionRegistrar } from './manage-hierarchy-permission.registrar.js';

@Module({
  providers: [HierarchyPermissionService, ManageHierarchyPermissionRegistrar],
  exports: [HierarchyPermissionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class HierarchyPermissionModule {}
