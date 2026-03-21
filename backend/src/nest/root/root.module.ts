/**
 * Root Module
 */
import { Module } from '@nestjs/common';

import { TenantDeletionModule } from '../tenant-deletion/tenant-deletion.module.js';
import { RootAdminService } from './root-admin.service.js';
import { RootDeletionService } from './root-deletion.service.js';
import { RootTenantService } from './root-tenant.service.js';
import { RootController } from './root.controller.js';
import { RootService } from './root.service.js';

@Module({
  imports: [TenantDeletionModule],
  controllers: [RootController],
  providers: [RootService, RootAdminService, RootTenantService, RootDeletionService],
  exports: [RootService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class RootModule {}
