/**
 * TPM Schedule Projection Service
 *
 * Projects all active TPM plans' maintenance dates into the future.
 * Used for cross-plan conflict detection when creating/editing a plan.
 *
 * Intervall-Kaskade Prinzip:
 *   - Each plan automatically projects 4 intervals: monthly, quarterly,
 *     semi_annual, annual (daily/weekly are operator tasks, excluded).
 *   - Seed date = Nth weekday of plan creation month (or next month).
 *   - All dates are deterministic from plan config alone (no cards needed).
 *
 * Algorithm:
 *   1. Load all active plans (plan config only, no card JOIN)
 *   2. Calculate seed date per plan via getNthWeekdayOfMonth()
 *   3. For each plan × 4 intervals, generate dates within [start, end]
 *   4. Deduplicate per plan+date (cascade dates merge intervalTypes[])
 *   5. Compute time windows (base_time + buffer_hours)
 *   6. Sort by date + startTime
 *
 * Dependencies: DatabaseService, TpmPlansIntervalService
 */
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import type {
  ProjectedSlot,
  ScheduleProjectionResult,
  TpmIntervalType,
} from './tpm.types.js';

/** DB row from the active plans query (no card data) */
interface PlanRow {
  plan_uuid: string;
  plan_name: string;
  asset_id: number;
  asset_name: string;
  base_weekday: number;
  base_repeat_every: number;
  base_time: string | null;
  buffer_hours: string; // NUMERIC → string from pg
  plan_created_at: string;
}

/** Intermediate plan data with pre-calculated seed date */
interface PlanProjectionData {
  planUuid: string;
  planName: string;
  assetId: number;
  assetName: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  bufferHours: number;
  seedDate: Date;
}

/** Intervals projected from plan config (operator tasks excluded) */
const PROJECTION_INTERVALS: readonly TpmIntervalType[] = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
] as const;

/** Max projection range in days */
const MAX_PROJECTION_DAYS = 365;

@Injectable()
export class TpmScheduleProjectionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly intervalService: TpmPlansIntervalService,
  ) {}

  /**
   * Project maintenance schedules for all active plans of a tenant.
   *
   * @param tenantId - Tenant isolation
   * @param startDate - Range start (YYYY-MM-DD)
   * @param endDate - Range end (YYYY-MM-DD), max 365 days from start
   * @param excludePlanUuid - Exclude this plan (for edit mode, avoid self-conflict)
   */
  async projectSchedules(
    tenantId: number,
    startDate: string,
    endDate: string,
    excludePlanUuid?: string,
  ): Promise<ScheduleProjectionResult> {
    const rows = await this.fetchActivePlans(tenantId, excludePlanUuid);

    if (rows.length === 0) {
      return {
        slots: [],
        dateRange: { start: startDate, end: endDate },
        planCount: 0,
      };
    }

    const plans = this.mapToPlanProjections(rows);
    const rawSlots = this.generateAllSlots(plans, startDate, endDate);
    const deduped = deduplicateSlots(rawSlots);

    deduped.sort(compareSlots);

    return {
      slots: deduped,
      dateRange: { start: startDate, end: endDate },
      planCount: plans.length,
    };
  }

  /** Load all active plans (plan config only, no card JOIN) */
  private async fetchActivePlans(
    tenantId: number,
    excludePlanUuid?: string,
  ): Promise<PlanRow[]> {
    const params: unknown[] = [tenantId];
    let excludeClause = '';

    if (excludePlanUuid !== undefined) {
      excludeClause = 'AND p.uuid != $2';
      params.push(excludePlanUuid);
    }

    return await this.db.query<PlanRow>(
      `SELECT
         p.uuid AS plan_uuid,
         p.name AS plan_name,
         p.asset_id,
         m.name AS asset_name,
         p.base_weekday,
         p.base_repeat_every,
         p.base_time,
         p.buffer_hours,
         p.created_at AS plan_created_at
       FROM tpm_maintenance_plans p
       JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1 AND p.is_active = 1 ${excludeClause}
       ORDER BY p.name`,
      params,
    );
  }

  /** Convert DB rows to projection data with pre-calculated seed dates */
  private mapToPlanProjections(rows: PlanRow[]): PlanProjectionData[] {
    return rows.map((row: PlanRow) => ({
      planUuid: row.plan_uuid.trim(),
      planName: row.plan_name,
      assetId: row.asset_id,
      assetName: row.asset_name,
      baseWeekday: row.base_weekday,
      baseRepeatEvery: row.base_repeat_every,
      baseTime: row.base_time,
      bufferHours: Number(row.buffer_hours),
      seedDate: this.calculateSeedDate(
        row.plan_created_at,
        row.base_weekday,
        row.base_repeat_every,
      ),
    }));
  }

  /**
   * Calculate the seed date for interval projection.
   * Finds the Nth weekday of the plan's creation month.
   * If that date is before creation → use Nth weekday of next month.
   */
  private calculateSeedDate(
    planCreatedAt: string,
    baseWeekday: number,
    baseRepeatEvery: number,
  ): Date {
    const created = new Date(planCreatedAt);
    created.setUTCHours(0, 0, 0, 0);

    const sameMonth = this.intervalService.getNthWeekdayOfMonth(
      created.getUTCFullYear(),
      created.getUTCMonth(),
      baseWeekday,
      baseRepeatEvery,
    );

    if (sameMonth >= created) return sameMonth;

    const nextMonth = new Date(created);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return this.intervalService.getNthWeekdayOfMonth(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth(),
      baseWeekday,
      baseRepeatEvery,
    );
  }

  /** Generate projected slots for all plans × 4 intervals across the date range */
  private generateAllSlots(
    plans: PlanProjectionData[],
    startDate: string,
    endDate: string,
  ): ProjectedSlot[] {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const allSlots: ProjectedSlot[] = [];

    for (const plan of plans) {
      for (const intervalType of PROJECTION_INTERVALS) {
        const dates = this.generateDates(plan, intervalType, start, end);

        for (const date of dates) {
          allSlots.push(createSlot(plan, intervalType, date));
        }
      }
    }

    return allSlots;
  }

  /**
   * Generate all dates for a single plan × interval within [start, end].
   * Iterates from seed using calculateIntervalDate until past endDate.
   */
  private generateDates(
    plan: PlanProjectionData,
    intervalType: TpmIntervalType,
    start: Date,
    end: Date,
  ): Date[] {
    const dates: Date[] = [];
    let current = new Date(plan.seedDate);
    current.setUTCHours(0, 0, 0, 0);

    const anchor = { weekday: plan.baseWeekday, nth: plan.baseRepeatEvery };
    let iterations = 0;

    while (current <= end && iterations < MAX_PROJECTION_DAYS) {
      if (current >= start) {
        dates.push(new Date(current));
      }

      current = this.intervalService.calculateIntervalDate(
        current,
        intervalType,
        null,
        anchor,
      );

      iterations++;
    }

    return dates;
  }
}

// ============================================================================
// Pure helper functions (module-level, no DI)
// ============================================================================

/** Create a ProjectedSlot from plan data + interval type + date */
function createSlot(
  plan: PlanProjectionData,
  intervalType: TpmIntervalType,
  date: Date,
): ProjectedSlot {
  const { startTime, endTime } = calculateTimeWindow(
    plan.baseTime,
    plan.bufferHours,
  );
  return {
    planUuid: plan.planUuid,
    planName: plan.planName,
    assetId: plan.assetId,
    assetName: plan.assetName,
    intervalTypes: [intervalType],
    date: formatDate(date),
    startTime,
    endTime,
    bufferHours: plan.bufferHours,
    isFullDay: plan.baseTime === null,
  };
}

/**
 * Deduplicate slots: merge same plan+date into one slot with combined intervalTypes[].
 * Multiple interval types on the same day for the same plan → one slot.
 */
function deduplicateSlots(slots: ProjectedSlot[]): ProjectedSlot[] {
  const map = new Map<string, ProjectedSlot>();

  for (const slot of slots) {
    const key = `${slot.planUuid}::${slot.date}`;
    const existing = map.get(key);

    if (existing !== undefined) {
      mergeIntervalTypes(existing.intervalTypes, slot.intervalTypes);
    } else {
      map.set(key, { ...slot, intervalTypes: [...slot.intervalTypes] });
    }
  }

  return [...map.values()];
}

/** Merge source interval types into target (no duplicates) */
function mergeIntervalTypes(
  target: TpmIntervalType[],
  source: readonly TpmIntervalType[],
): void {
  for (const it of source) {
    if (!target.includes(it)) {
      target.push(it);
    }
  }
}

/** Calculate time window from base_time + buffer_hours */
function calculateTimeWindow(
  baseTime: string | null,
  bufferHours: number,
): { startTime: string | null; endTime: string | null } {
  if (baseTime === null) {
    return { startTime: null, endTime: null };
  }

  const parts = baseTime.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const totalMinutes = hours * 60 + minutes + bufferHours * 60;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = Math.round(totalMinutes % 60);

  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  return { startTime: baseTime, endTime };
}

/** Sort comparator: by date ASC, then startTime ASC (nulls last) */
function compareSlots(a: ProjectedSlot, b: ProjectedSlot): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;

  if (a.startTime === null && b.startTime === null) return 0;
  if (a.startTime === null) return 1;
  if (b.startTime === null) return -1;
  return a.startTime.localeCompare(b.startTime);
}

/** Parse YYYY-MM-DD to Date at UTC midnight */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

/** Format Date to YYYY-MM-DD (UTC-safe) */
function formatDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
