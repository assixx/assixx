/**
 * Root Module
 */
import { Module } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
import { OrganigramModule } from '../organigram/organigram.module.js';
import { TenantDeletionModule } from '../tenant-deletion/tenant-deletion.module.js';
import { RootAdminService } from './root-admin.service.js';
import { RootDeletionService } from './root-deletion.service.js';
import { RootProtectionService } from './root-protection.service.js';
import { RootSelfTerminationController } from './root-self-termination.controller.js';
import { RootSelfTerminationService } from './root-self-termination.service.js';
import { RootTenantService } from './root-tenant.service.js';
import { RootController } from './root.controller.js';
import { RootService } from './root.service.js';

@Module({
  // DomainsModule provides `TenantVerificationService` — required by both
  // `RootService.insertRootUserRecord` and `RootAdminService.insertAdminRecord`
  // per §2.9 KISS gate (§0.2.5 #1 + D33).
  imports: [OrganigramModule, TenantDeletionModule, DomainsModule],
  // RootSelfTerminationController — Step 2.5 of FEAT_ROOT_ACCOUNT_PROTECTION.
  // Mounts 6 endpoints under `/api/v2/users/...` for the peer-approval
  // lifecycle (request, list pending, approve, reject, cancel). Path-collision
  // audit vs UsersController verified safe — see controller header.
  controllers: [RootController, RootSelfTerminationController],
  providers: [
    RootService,
    RootAdminService,
    RootTenantService,
    RootDeletionService,
    // RootProtectionService — Layer 2 of root-account protection
    // (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.1, Step 2.2). Exported
    // so UsersModule + DummyUsersModule can wire the assertions in Session 4.
    RootProtectionService,
    // RootSelfTerminationService — Layer 3 (peer-approval lifecycle)
    // (masterplan §2.1 Step 2.4 / Session 5). Exported so the controller
    // (Step 2.5) and the cron (Step 2.6) can consume it without a circular
    // import; future Step 2.7 notification handlers also subscribe via the
    // EventBus singleton — no DI dependency from outside RootModule today.
    RootSelfTerminationService,
  ],
  exports: [RootService, RootProtectionService, RootSelfTerminationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class RootModule {}
