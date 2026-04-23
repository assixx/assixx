/**
 * Shift Handover — Auto-Lock Cron (Plan §2.8).
 *
 * Periodically locks abandoned handover drafts. Scans cross-tenant for
 * any `shift_handover_entries` row whose shift ended more than 24 h ago
 * (Europe/Berlin, DST-correct) and is still `status = 'draft'`, then
 * transitions each to `'submitted'` with `submitted_by = NULL` (sentinel
 * for "system auto-locked", plan §1.2). The actual SQL — including the
 * `AT TIME ZONE 'Europe/Berlin' + interval '24 hours'` cutoff math and
 * the per-row template snapshot — lives in
 * `ShiftHandoverEntriesService.runAutoLockSweep(nowUtc)` (plan §2.5).
 * This service is the thin scheduling shim around it.
 *
 * Schedule: top of every 6 hours, pinned to Europe/Berlin. The fixed TZ
 * keeps firing times predictable for German operations across DST
 * transitions; the 6 h cadence means a draft sits at most 6 h past the
 * 24 h cutoff before being locked — acceptable per Product Decision #5
 * (manual submit; auto-lock 24 h after shift end).
 *
 * Cross-tenant model: `runAutoLockSweep` runs through
 * `db.systemTransaction()` on the `sys_user` pool (BYPASSRLS per
 * ADR-019). No CLS context is required — `nowUtc` is an explicit
 * parameter so the §2.5 purity contract is preserved end-to-end and
 * tests can pin the sweep at fixed instants.
 *
 * Error handling: a `@Cron` handler must never throw — NestJS does not
 * retry, and an uncaught throw is silently swallowed but pollutes the
 * process exit channel. We trap, log via `getErrorMessage()` (TS-
 * Standards §7.3, no `(error as Error)` casts), and return; the next
 * 6 h tick is the natural retry.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.8 + Product Decision #5
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { getErrorMessage } from '../common/index.js';
import { ShiftHandoverEntriesService } from './shift-handover-entries.service.js';

/** Hoisted to a constant so the cron expression is the only place the
 *  literal `*` plus `/` sequence appears — keeps it out of any
 *  surrounding doc-block where the same two characters would close the
 *  comment early on some parsers. */
const SHIFT_HANDOVER_AUTO_LOCK_CRON = '0 */6 * * *';

/** Cap the id-list dump in the success log so a worst-case lock burst
 *  doesn't produce an unbounded line. Operations grep the log for the
 *  count first; the full id list is recoverable via `pgmigrations` /
 *  `audit_trail` if needed. */
const MAX_LOGGED_IDS = 10;

@Injectable()
export class ShiftHandoverCronService {
  private readonly logger = new Logger(ShiftHandoverCronService.name);

  constructor(private readonly entries: ShiftHandoverEntriesService) {}

  @Cron(SHIFT_HANDOVER_AUTO_LOCK_CRON, {
    name: 'shift-handover-auto-lock',
    timeZone: 'Europe/Berlin',
  })
  async runScheduledAutoLockSweep(): Promise<void> {
    const nowUtc = new Date();
    this.logger.debug(`[auto-lock] Sweep started at ${nowUtc.toISOString()}`);
    try {
      const result = await this.entries.runAutoLockSweep(nowUtc);
      if (result.lockedCount > 0) {
        const head = result.lockedIds.slice(0, MAX_LOGGED_IDS).join(',');
        const suffix = result.lockedIds.length > MAX_LOGGED_IDS ? '…' : '';
        this.logger.log(
          `[auto-lock] Locked ${String(result.lockedCount)} abandoned draft(s); ids=${head}${suffix}`,
        );
      } else {
        this.logger.debug('[auto-lock] No drafts to lock');
      }
    } catch (error: unknown) {
      this.logger.error(`[auto-lock] Sweep failed: ${getErrorMessage(error)}`);
    }
  }
}
