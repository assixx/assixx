/**
 * Shift Handover — Active-Shift Resolver (Plan §2.3, Risk R1/R5/R9).
 *
 * Pure, time-aware helper that answers three operational questions:
 *
 *  1. Who is assigned to `(team, date, slot)`?
 *     → `resolveAssignees()` unions `shifts` and `shift_rotation_history`
 *       (ADR-011 dual-source, R9). The plan's §0.8 spike locked the
 *       enum-equivalence mapping: slot `early` ↔ `shifts.type ∈ {early,F}`
 *       ∪ `shift_rotation_history.shift_type = 'F'` (and analogues for
 *       late/S, night/N). Canonical merge reference:
 *       `backend/src/nest/shifts/shifts.service.ts` L681–691.
 *
 *  2. May `user` write a handover for `(team, date, slot)` right now?
 *     → `canWriteForShift()` applies two rules:
 *        (a) user ∈ assignees,
 *        (b) write window = Europe/Berlin "today" OR (night-slot AND
 *            shiftDate = yesterday AND `now < shift_end`).
 *     Timezone math runs in PostgreSQL (`AT TIME ZONE 'Europe/Berlin'`)
 *     to leverage the engine's DST table rather than re-implement it in JS.
 *
 *  3. Is a draft eligible for the 24 h auto-lock sweep?
 *     → `getAutoLockCutoff()` — `now > shift_end_berlin + 24h`.
 *
 * Purity contract (plan §2.3):
 *  - No `Date.now()`, no `process.env.TZ`. Every timing input (`nowUtc`,
 *    `shiftDate`, `shiftEndTime`) is an explicit parameter so tests can
 *    inject fixed instants and the behaviour becomes deterministic.
 *  - Tenant isolation uses `queryAsTenant(sql, params, tenantId)` with
 *    an explicit tenantId (ADR-019): keeps the service callable outside
 *    an HTTP/CLS context (cron jobs, unit tests).
 *  - Team-Lead bypass is handled one layer up at the controller via
 *    `@RequirePermission` + `canManage` (ADR-045 Layer 1/2). This
 *    service answers "is the user an assignee?" literally.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.3 + §0.8 + §R1/R5/R9
 * @see docs/infrastructure/adr/ADR-011-shift-data-architecture.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
  ActiveShiftContext,
  ShiftHandoverSlot,
  ShiftHandoverWriteDecision,
} from './shift-handover.types.js';

/**
 * Slot → `shifts.type` enum values. `shifts.type` is mixed-domain (slot
 * markers + labor-law values); we accept both spellings because prod data
 * uses `early/late/night` in some tenants and `F/S/N` in others.
 * Verified in §0.8 spike against both test-tenant datasets.
 */
const SLOT_TO_SHIFTS_TYPES: Record<ShiftHandoverSlot, readonly string[]> = {
  early: ['early', 'F'],
  late: ['late', 'S'],
  night: ['night', 'N'],
};

/**
 * Slot → `shift_rotation_history.shift_type` enum value. The rotation
 * enum is pure slot-domain `{F,S,N}` (verified §0.8), so a single value
 * suffices per slot.
 */
const SLOT_TO_ROTATION_TYPE: Record<ShiftHandoverSlot, string> = {
  early: 'F',
  late: 'S',
  night: 'N',
};

/** Formats a JS `Date` as `YYYY-MM-DD` using its UTC components. Backend
 *  containers run UTC (ADR-014 + docker-compose); `DATE` columns surface
 *  as UTC-midnight `Date` instances, so the UTC date matches the Berlin
 *  calendar date by construction (midnight UTC → 01:00/02:00 Berlin →
 *  same calendar day). Callers creating dates manually must pass UTC
 *  `Date` instances or ISO strings parsed as UTC. */
function toIsoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Subtracts one calendar day from an ISO `YYYY-MM-DD` string, UTC. */
function subtractOneDayIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ActiveShiftResolverService {
  private readonly logger = new Logger(ActiveShiftResolverService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns user IDs assigned to `(team, date, slot)`, unioned across
   * `shifts` and `shift_rotation_history`. SQL `UNION` de-duplicates at
   * the engine level; caller may still treat the result defensively.
   * NULL `user_id` rows (unassigned shifts) are filtered out.
   */
  async resolveAssignees(
    tenantId: number,
    teamId: number,
    shiftDate: Date,
    shiftKey: ShiftHandoverSlot,
  ): Promise<number[]> {
    this.logger.debug(
      `resolveAssignees tenant=${tenantId} team=${teamId} date=${toIsoDateUtc(shiftDate)} slot=${shiftKey}`,
    );
    const shiftDateStr = toIsoDateUtc(shiftDate);
    const shiftsTypes = SLOT_TO_SHIFTS_TYPES[shiftKey];
    const rotationType = SLOT_TO_ROTATION_TYPE[shiftKey];
    const rows = await this.db.queryAsTenant<{ user_id: number }>(
      `SELECT user_id
         FROM shifts
        WHERE team_id = $1
          AND date = $2::date
          AND user_id IS NOT NULL
          AND type::text = ANY($3::text[])
        UNION
       SELECT user_id
         FROM shift_rotation_history
        WHERE team_id = $1
          AND shift_date = $2::date
          AND user_id IS NOT NULL
          AND shift_type::text = $4`,
      [teamId, shiftDateStr, shiftsTypes, rotationType],
      tenantId,
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }

  /**
   * Decides whether `ctx.userId` may write the handover for the given
   * shift right now. Returns a discriminated result so the caller can
   * render a reason-specific message (smoke-test finding 2026-04-23 —
   * a boolean collapsed 3 distinct causes into one unhelpful string).
   *
   * Rules applied in order:
   *   1. user ∈ assignees → otherwise `{reason: 'not_assignee'}`
   *   2. TZ-aware write-window check → `outside_window` or
   *      `shift_times_missing` on failure
   *
   * Team-Lead bypass lives at the controller level (ADR-045 Layer 2), not here.
   */
  async canWriteForShift(ctx: ActiveShiftContext): Promise<ShiftHandoverWriteDecision> {
    const assignees = await this.resolveAssignees(
      ctx.tenantId,
      ctx.teamId,
      ctx.shiftDate,
      ctx.shiftKey,
    );
    if (!assignees.includes(ctx.userId)) {
      return { allowed: false, reason: 'not_assignee' };
    }
    return await this.checkWriteWindow(ctx);
  }

  /**
   * Time-window sub-check, extracted to keep `canWriteForShift` flat
   * (Power-of-Ten cognitive-complexity cap). Returns `{allowed: true}`
   * iff shiftDate is today in Berlin, OR the active window is a night
   * shift from the previous Berlin day that has not yet ended.
   * Distinguishes `outside_window` from `shift_times_missing` so the
   * caller can tell the user to contact IT instead of waiting for the
   * right date.
   */
  private async checkWriteWindow(ctx: ActiveShiftContext): Promise<ShiftHandoverWriteDecision> {
    const shiftDateStr = toIsoDateUtc(ctx.shiftDate);
    const rows = await this.db.queryAsTenant<{
      today_berlin: string;
      shift_end_utc: Date;
    }>(
      `SELECT
         to_char(($1::timestamptz AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD')
           AS today_berlin,
         (($2::date + st.end_time) AT TIME ZONE 'Europe/Berlin')
           AS shift_end_utc
         FROM shift_times st
        WHERE st.shift_key = $3
          AND st.is_active = $4`,
      [ctx.nowUtc.toISOString(), shiftDateStr, ctx.shiftKey, IS_ACTIVE.ACTIVE],
      ctx.tenantId,
    );
    const row = rows[0];
    if (row === undefined) {
      return { allowed: false, reason: 'shift_times_missing' };
    }
    if (row.today_berlin === shiftDateStr) {
      return { allowed: true };
    }
    if (ctx.shiftKey !== 'night') {
      return { allowed: false, reason: 'outside_window' };
    }
    if (subtractOneDayIso(row.today_berlin) !== shiftDateStr) {
      return { allowed: false, reason: 'outside_window' };
    }
    return ctx.nowUtc.getTime() < row.shift_end_utc.getTime() ?
        { allowed: true }
      : { allowed: false, reason: 'outside_window' };
  }

  /**
   * Returns the configured clock-times for a slot as `HH:MM:SS` strings.
   * Throws `NotFoundException` when the tenant has not configured the
   * slot — callers depend on this for the 24 h auto-lock and for
   * client-side shift-window display.
   */
  async getShiftEndClock(
    tenantId: number,
    shiftKey: ShiftHandoverSlot,
  ): Promise<{ startTime: string; endTime: string }> {
    const rows = await this.db.queryAsTenant<{
      start_time: string;
      end_time: string;
    }>(
      `SELECT start_time::text AS start_time,
              end_time::text   AS end_time
         FROM shift_times
        WHERE shift_key = $1
          AND is_active = $2`,
      [shiftKey, IS_ACTIVE.ACTIVE],
      tenantId,
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(
        `shift_times not configured for slot "${shiftKey}" in tenant ${tenantId}`,
      );
    }
    return { startTime: row.start_time, endTime: row.end_time };
  }

  /**
   * Returns `true` when the 24 h grace window after the shift end has
   * elapsed (auto-lock eligible). Pure given `(entry, nowUtc)`; uses
   * PostgreSQL's DST-correct `AT TIME ZONE` for Berlin-local math. Does
   * not require RLS context — no tenant-scoped tables are touched.
   */
  async getAutoLockCutoff(
    entry: { shiftDate: Date; shiftEndTime: string },
    nowUtc: Date,
  ): Promise<boolean> {
    const rows = await this.db.query<{ cutoff_passed: boolean }>(
      `SELECT (
         $1::timestamptz
         > (($2::date + $3::time) AT TIME ZONE 'Europe/Berlin' + interval '24 hours')
       ) AS cutoff_passed`,
      [nowUtc.toISOString(), toIsoDateUtc(entry.shiftDate), entry.shiftEndTime],
    );
    return rows[0]?.cutoff_passed === true;
  }
}
