/**
 * Root Module
 */
import { Module } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
import { OrganigramModule } from '../organigram/organigram.module.js';
import { TenantDeletionModule } from '../tenant-deletion/tenant-deletion.module.js';
import { RootAdminService } from './root-admin.service.js';
import { RootDeletionService } from './root-deletion.service.js';
import { RootTenantService } from './root-tenant.service.js';
import { RootController } from './root.controller.js';
import { RootService } from './root.service.js';

@Module({
  // DomainsModule provides `TenantVerificationService` — required by both
  // `RootService.insertRootUserRecord` and `RootAdminService.insertAdminRecord`
  // per §2.9 KISS gate (§0.2.5 #1 + D33).
  imports: [OrganigramModule, TenantDeletionModule, DomainsModule],
  controllers: [RootController],
  providers: [RootService, RootAdminService, RootTenantService, RootDeletionService],
  exports: [RootService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class RootModule {}
