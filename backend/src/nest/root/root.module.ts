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
import { RootSelfTerminationNotificationService } from './root-self-termination-notification.service.js';
import { RootSelfTerminationController } from './root-self-termination.controller.js';
import { RootSelfTerminationCron } from './root-self-termination.cron.js';
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
    // RootSelfTerminationNotificationService — Step 2.7 of
    // FEAT_ROOT_ACCOUNT_PROTECTION. Domain-specific subscriber that owns
    // typed EventBus emits + persistent notification rows for the 3
    // user-facing lifecycle events (Requested / Approved / Rejected).
    // Spec Deviation D7 (vs. masterplan §2.7 literal "modify
    // notifications.service.ts"): follows established repo convention
    // (vacation/work-orders/tpm) of co-located per-domain subscribers
    // — `notifications.service.ts` stays domain-agnostic.
    // Declared BEFORE `RootSelfTerminationService` because the latter
    // injects this notification service for post-commit fan-out.
    RootSelfTerminationNotificationService,
    // RootSelfTerminationService — Layer 3 (peer-approval lifecycle)
    // (masterplan §2.1 Step 2.4 / Session 5). Exported so the controller
    // (Step 2.5) and the cron (Step 2.6) can consume it without a circular
    // import. Step 2.7 (this commit) injects RootSelfTerminationNotificationService
    // for typed EventBus emits + persistent notification rows.
    RootSelfTerminationService,
    // RootSelfTerminationCron — Step 2.6 of FEAT_ROOT_ACCOUNT_PROTECTION.
    // Daily 03:00 expiry sweep for stale `pending` rows; thin scheduler
    // wrapper around `RootSelfTerminationService.expireOldRequests()`.
    // ScheduleModule.forRoot() is registered globally in app.module.ts —
    // no per-module ScheduleModule import needed (KVP / log-retention /
    // blackboard-archive crons follow the same pattern). Not exported —
    // internal scheduler only, no consumer outside RootModule.
    RootSelfTerminationCron,
    // Phase 8 of FEAT_ROOT_ACCOUNT_PROTECTION (email fan-out for the 3
    // self-termination lifecycle events) lives DIRECTLY inside
    // `RootSelfTerminationNotificationService` and uses the legacy
    // `email-service.ts` transport without going through the MailerService
    // DI wrapper. Rationale: MailerService was becoming a cross-domain
    // god object — see `docs/REFACTOR_MAILER_SERVICE_GOD_OBJECT.md` and
    // the same Spec Deviation D7 that put SSE + persistent INSERT into
    // a per-domain notification service.
  ],
  exports: [RootService, RootProtectionService, RootSelfTerminationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class RootModule {}
