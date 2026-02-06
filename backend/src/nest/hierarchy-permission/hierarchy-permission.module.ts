/**
 * Hierarchy Permission Module
 *
 * Provides HierarchyPermissionService for permission checks
 * with Area → Department → Team inheritance.
 */
import { Module } from '@nestjs/common';

import { HierarchyPermissionService } from './hierarchy-permission.service.js';

@Module({
  providers: [HierarchyPermissionService],
  exports: [HierarchyPermissionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class HierarchyPermissionModule {}
