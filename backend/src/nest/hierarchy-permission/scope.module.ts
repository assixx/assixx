/**
 * Scope Module
 *
 * Provides ScopeService for lazy organizational scope resolution.
 * Import this module in any feature module that needs scope-filtered data.
 */
import { Module } from '@nestjs/common';

import { HierarchyPermissionModule } from './hierarchy-permission.module.js';
import { ScopeService } from './scope.service.js';

@Module({
  imports: [HierarchyPermissionModule],
  providers: [ScopeService],
  exports: [ScopeService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class ScopeModule {}
