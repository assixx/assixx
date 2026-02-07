/**
 * Permission Registry Module
 *
 * Global singleton — imported once in AppModule.
 * Feature modules inject PermissionRegistryService to register their permissions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Global, Module } from '@nestjs/common';

import { PermissionRegistryService } from './permission-registry.service.js';

@Global()
@Module({
  providers: [PermissionRegistryService],
  exports: [PermissionRegistryService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class PermissionRegistryModule {}
