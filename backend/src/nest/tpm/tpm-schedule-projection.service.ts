/**
 * TPM Schedule Projection Service
 *
 * Projects all active TPM plans' maintenance dates into the future.
 * Used for cross-plan conflict detection when creating/editing a plan.
 *
 * Algorithm:
 *   1. Load all active plans + their cards (interval types + due dates)
 *   2. For each plan×intervalType, generate all dates within [start, end]
 *   3. Deduplicate per plan+date (multiple intervals → one slot with intervalTypes[])
 *   4. Compute time windows (base_time + buffer_hours)
 *   5. Sort by date + startTime
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

/** DB row from the plan+card JOIN query */
interface PlanCardRow {
  plan_uuid: string;
  plan_name: string;
  machine_id: number;
  machine_name: string;
  base_weekday: number;
  base_repeat_every: number;
  base_time: string | null;
  buffer_hours: string; // NUMERIC → string from pg
  plan_created_at: string;
  interval_type: TpmIntervalType;
  custom_interval_days: number | null;
  weekday_override: number | null;
  current_due_date: string | null;
}

/** Intermediate grouped plan data */
interface PlanProjectionData {
  planUuid: string;
  planName: string;
  machineId: number;
  machineName: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  bufferHours: number;
  planCreatedAt: string;
  intervals: IntervalSeed[];
}

/** One interval type with its seed date for iteration */
interface IntervalSeed {
  intervalType: TpmIntervalType;
  customIntervalDays: number | null;
  weekdayOverride: number | null;
  seedDate: string; // earliest current_due_date or plan created_at
}

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
    const rows = await this.fetchPlanCards(tenantId, excludePlanUuid);

    if (rows.length === 0) {
      return {
        slots: [],
        dateRange: { start: startDate, end: endDate },
        planCount: 0,
      };
    }

    const plans = groupByPlan(rows);
    const rawSlots = this.generateAllSlots(plans, startDate, endDate);
    const deduped = deduplicateSlots(rawSlots);

    deduped.sort(compareSlots);

    return {
      slots: deduped,
      dateRange: { start: startDate, end: endDate },
      planCount: plans.length,
    };
  }

  /** Load all active plans with their active cards' interval info */
  private async fetchPlanCards(
    tenantId: number,
    excludePlanUuid?: string,
  ): Promise<PlanCardRow[]> {
    const params: unknown[] = [tenantId];
    let excludeClause = '';

    if (excludePlanUuid !== undefined) {
      excludeClause = 'AND p.uuid != $2';
      params.push(excludePlanUuid);
    }

    return await this.db.query<PlanCardRow>(
      `SELECT
         p.uuid AS plan_uuid,
         p.name AS plan_name,
         p.machine_id,
         m.name AS machine_name,
         p.base_weekday,
         p.base_repeat_every,
         p.base_time,
         p.buffer_hours,
         p.created_at AS plan_created_at,
         c.interval_type,
         c.custom_interval_days,
         c.weekday_override,
         c.current_due_date
       FROM tpm_maintenance_plans p
       JOIN machines m ON p.machine_id = m.id AND m.tenant_id = p.tenant_id
       JOIN tpm_cards c ON c.plan_id = p.id AND c.tenant_id = p.tenant_id AND c.is_active = 1
       WHERE p.tenant_id = $1 AND p.is_active = 1 ${excludeClause}
       ORDER BY p.name, c.interval_type, c.current_due_date ASC NULLS LAST`,
      params,
    );
  }

  /** Generate projected slots for all plans across the date range */
  private generateAllSlots(
    plans: PlanProjectionData[],
    startDate: string,
    endDate: string,
  ): ProjectedSlot[] {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const allSlots: ProjectedSlot[] = [];

    for (const plan of plans) {
      for (const interval of plan.intervals) {
        const dates = this.generateDatesForInterval(plan, interval, start, end);

        for (const date of dates) {
          const dateStr = formatDate(date);
          const { startTime, endTime } = calculateTimeWindow(
            plan.baseTime,
            plan.bufferHours,
          );

          allSlots.push({
            planUuid: plan.planUuid,
            planName: plan.planName,
            machineId: plan.machineId,
            machineName: plan.machineName,
            intervalTypes: [interval.intervalType],
            date: dateStr,
            startTime,
            endTime,
            bufferHours: plan.bufferHours,
            isFullDay: plan.baseTime === null,
          });
        }
      }
    }

    return allSlots;
  }

  /**
   * Generate all dates for a single plan×interval within [start, end].
   *
   * Strategy: Start from the seed date (earliest card due date or plan creation),
   * iterate forward using TpmPlansIntervalService until past endDate.
   * Collect dates that fall within [start, end].
   */
  private generateDatesForInterval(
    plan: PlanProjectionData,
    interval: IntervalSeed,
    start: Date,
    end: Date,
  ): Date[] {
    const effectiveWeekday = interval.weekdayOverride ?? plan.baseWeekday;

    if (interval.intervalType === 'daily') {
      return this.generateDailyDates(start, end);
    }

    if (interval.intervalType === 'weekly') {
      return this.generateWeeklyDates(
        effectiveWeekday,
        plan.baseRepeatEvery,
        start,
        end,
        parseDate(interval.seedDate),
      );
    }

    // Monthly+ intervals: iterate from seed using calculateIntervalDate
    return this.generateMonthlyPlusDates(
      plan,
      interval,
      effectiveWeekday,
      start,
      end,
    );
  }

  /** Daily: every day in the range */
  private generateDailyDates(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Weekly: every Nth week on the given weekday.
   * Uses seed date to establish the phase of the repeating pattern.
   */
  private generateWeeklyDates(
    weekday: number,
    repeatEvery: number,
    start: Date,
    end: Date,
    seed: Date,
  ): Date[] {
    const dates: Date[] = [];
    const jsWeekday = (weekday + 1) % 7;

    // Find the first occurrence of the weekday on or after seed
    const firstOccurrence = new Date(seed);
    firstOccurrence.setHours(0, 0, 0, 0);
    const daysUntilWeekday = (jsWeekday - firstOccurrence.getDay() + 7) % 7;
    firstOccurrence.setDate(firstOccurrence.getDate() + daysUntilWeekday);

    // Calculate step in days
    const stepDays = repeatEvery * 7;

    // Fast-forward to start of range (avoid iterating through distant past)
    let current = new Date(firstOccurrence);
    if (current < start) {
      const daysToStart = Math.floor(
        (start.getTime() - current.getTime()) / (1000 * 60 * 60 * 24),
      );
      const stepsToSkip = Math.floor(daysToStart / stepDays);
      current.setDate(current.getDate() + stepsToSkip * stepDays);
    }

    // Iterate through range
    while (current <= end) {
      if (current >= start) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + stepDays);
    }

    return dates;
  }

  /**
   * Monthly/quarterly/semi_annual/annual/long_runner/custom:
   * Iterate from seed using calculateIntervalDate until past end.
   */
  private generateMonthlyPlusDates(
    plan: PlanProjectionData,
    interval: IntervalSeed,
    effectiveWeekday: number,
    start: Date,
    end: Date,
  ): Date[] {
    const dates: Date[] = [];
    const seed = parseDate(interval.seedDate);
    let current = new Date(seed);
    current.setHours(0, 0, 0, 0);

    // Safety: max iterations to prevent infinite loops
    const maxIterations = MAX_PROJECTION_DAYS;
    let iterations = 0;

    while (current <= end && iterations < maxIterations) {
      if (current >= start) {
        dates.push(new Date(current));
      }

      // Calculate next occurrence
      const anchor = {
        weekday: effectiveWeekday,
        nth: plan.baseRepeatEvery,
      };

      current = this.intervalService.calculateIntervalDate(
        current,
        interval.intervalType,
        interval.customIntervalDays,
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

/** Group flat DB rows into PlanProjectionData[] with deduplicated intervals */
function groupByPlan(rows: PlanCardRow[]): PlanProjectionData[] {
  const planMap = new Map<string, PlanProjectionData>();
  /** Track seen interval types per plan to deduplicate */
  const seenIntervals = new Map<string, Set<TpmIntervalType>>();

  for (const row of rows) {
    let plan = planMap.get(row.plan_uuid);
    if (plan === undefined) {
      plan = {
        planUuid: row.plan_uuid.trim(),
        planName: row.plan_name,
        machineId: row.machine_id,
        machineName: row.machine_name,
        baseWeekday: row.base_weekday,
        baseRepeatEvery: row.base_repeat_every,
        baseTime: row.base_time,
        bufferHours: Number(row.buffer_hours),
        planCreatedAt:
          typeof row.plan_created_at === 'string' ?
            row.plan_created_at
          : new Date(row.plan_created_at).toISOString(),
        intervals: [],
      };
      planMap.set(row.plan_uuid, plan);
      seenIntervals.set(row.plan_uuid, new Set());
    }

    const seen = seenIntervals.get(row.plan_uuid) ?? new Set<TpmIntervalType>();
    if (!seen.has(row.interval_type)) {
      seen.add(row.interval_type);

      // Use earliest due date as seed, fallback to plan created_at
      const seedDate = row.current_due_date ?? plan.planCreatedAt.slice(0, 10);

      plan.intervals.push({
        intervalType: row.interval_type,
        customIntervalDays: row.custom_interval_days,
        weekdayOverride: row.weekday_override,
        seedDate,
      });
    }
  }

  return [...planMap.values()];
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

/** Parse YYYY-MM-DD to Date at midnight */
function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format Date to YYYY-MM-DD */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
