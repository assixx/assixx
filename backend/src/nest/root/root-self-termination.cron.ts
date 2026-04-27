/**
 * Root Self-Termination Cron
 *
 * Daily expiry sweep for `root_self_termination_requests` (Step 2.6 of
 * FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md). Runs at 03:00 daily and
 * delegates to `RootSelfTerminationService.expireOldRequests()`, which
 * uses `systemQuery()` (sys_user, BYPASSRLS) to sweep every tenant's
 * stale `pending` rows in one statement. Cross-tenant by design — the
 * cron is the only scheduled producer; HTTP callers cannot trigger it.
 *
 * The service method itself emits `root.self-termination.expired` events
 * per row (Step 2.7 will subscribe a notification handler), writes a
 * per-row `root_logs` audit entry via `ActivityLoggerService`, and logs
 * its own summary when count > 0. This cron adds one unconditional log
 * line (also at zero) so ops dashboards can confirm the daily tick
 * fired even on quiet days.
 *
 * Schedule `'0 3 * * *'` (UTC, no timezone option) intentionally mirrors
 * `LogRetentionService.handleRetentionCron` — one 03:00 daily-cleanup
 * window keeps maintenance traffic predictable across the backend.
 *
 * `ScheduleModule.forRoot()` is registered globally in `app.module.ts`,
 * so this provider needs no extra module-level imports — the @Cron
 * decorator is picked up via the registry on bootstrap.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.6 (verbatim spec)
 * @see backend/src/nest/root/root-self-termination.service.ts (expireOldRequests)
 * @see backend/src/nest/logs/log-retention.service.ts (sibling 03:00 pattern)
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { RootSelfTerminationService } from './root-self-termination.service.js';

@Injectable()
export class RootSelfTerminationCron {
  private readonly logger = new Logger(RootSelfTerminationCron.name);

  // Param name `service` matches the masterplan §2.6 spec body
  // (`this.service.expireOldRequests()`) — kept verbatim for grep parity.
  constructor(private readonly service: RootSelfTerminationService) {}

  /**
   * Daily 03:00 — flip stale `pending` rows past their `expires_at` to
   * `expired`. Service does the SQL + per-row audit + event fan-out;
   * cron only schedules and surface-logs.
   *
   * Spec Deviation D6 (vs. masterplan §2.6): `this.logger.info(...)` →
   * `this.logger.log(...)`. NestJS `Logger` (`@nestjs/common`) has no
   * `.info()` method — `.log()` is the standard info-level call across
   * the backend (`LogRetentionService`, `KvpApprovalArchiveCronService`,
   * `BlackboardArchiveService`, ...). Forced literal-text fix, identical
   * semantics. Logged here as a minor deviation for traceability.
   */
  @Cron('0 3 * * *')
  async expirePendingRequests(): Promise<void> {
    const expired = await this.service.expireOldRequests();
    this.logger.log(`Expired ${expired} root self-termination request(s)`);
  }
}
