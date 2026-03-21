// =============================================================================
// Gesamtansicht - Matrix Utility Functions
// =============================================================================

import type { TpmPlan, ProjectedSlot, IntervalType, TpmShiftAssignment } from '../../_lib/types';

/** One row in the matrix: plan + sorted dates per interval type */
export interface MatrixRow {
  plan: TpmPlan;
  cells: Record<IntervalType, string[]>;
}

/** Interval columns in display order (no daily/weekly) */
export const INTERVAL_COLUMNS: IntervalType[] = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
];

/**
 * Build the matrix from plans + projected slots.
 * Groups slots by planUuid × intervalType, sorts dates ascending,
 * and caps at maxDates per cell.
 */
export function buildMatrix(
  plans: TpmPlan[],
  slots: ProjectedSlot[],
  maxDates: number,
): MatrixRow[] {
  const slotIndex = indexSlots(slots);

  return plans.map((plan: TpmPlan): MatrixRow => {
    const cells = {} as Record<IntervalType, string[]>;
    for (const col of INTERVAL_COLUMNS) {
      const key = `${plan.uuid}:${col}`;
      const dates = slotIndex.get(key) ?? [];
      cells[col] = dates.slice(0, maxDates);
    }
    return { plan, cells };
  });
}

/**
 * Index projected slots into a Map keyed by "planUuid:intervalType".
 * Each value is a sorted (ascending) array of unique date strings.
 */
function indexSlots(slots: ProjectedSlot[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const slot of slots) {
    for (const interval of slot.intervalTypes) {
      const key = `${slot.planUuid}:${interval}`;
      let dateSet = map.get(key);
      if (dateSet === undefined) {
        dateSet = new Set<string>();
        map.set(key, dateSet);
      }
      dateSet.add(slot.date);
    }
  }

  const result = new Map<string, string[]>();
  for (const [key, dateSet] of map) {
    result.set(key, [...dateSet].sort());
  }
  return result;
}

/** Format ISO date to German format DD.MM.YYYY */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format plan time range for display: "09:00 – 14:00" */
export function formatTimeRange(baseTime: string | null, bufferHours: number): string {
  if (baseTime === null || baseTime.trim().length === 0) return '';
  const start = baseTime.substring(0, 5);
  const [h, m] = start.split(':').map(Number);
  const endTotal = (h + bufferHours) * 60 + m;
  const endH = String(Math.floor(endTotal / 60) % 24).padStart(2, '0');
  const endM = String(endTotal % 60).padStart(2, '0');
  return `${start} – ${endH}:${endM}`;
}

/** Check if plan is full-day (no base time set) */
export function isFullDay(baseTime: string | null): boolean {
  return baseTime === null || baseTime.trim().length === 0;
}

// =============================================================================
// Assignment Cross-Reference Utilities
// =============================================================================

/** Index projected schedule: "planUuid:date" → interval types */
export function buildDateIndex(rows: MatrixRow[]): Map<string, Set<IntervalType>> {
  const index = new Map<string, Set<IntervalType>>();
  for (const row of rows) {
    for (const col of INTERVAL_COLUMNS) {
      for (const date of row.cells[col]) {
        const key = `${row.plan.uuid}:${date}`;
        let set = index.get(key);
        if (set === undefined) {
          set = new Set();
          index.set(key, set);
        }
        set.add(col);
      }
    }
  }
  return index;
}

/** Add a name to the nested map structure (helper for buildAssignmentLookup) */
function addName(
  map: Map<string, Map<IntervalType, Set<string>>>,
  planUuid: string,
  interval: IntervalType,
  name: string,
): void {
  let byInterval = map.get(planUuid);
  if (byInterval === undefined) {
    byInterval = new Map();
    map.set(planUuid, byInterval);
  }
  let names = byInterval.get(interval);
  if (names === undefined) {
    names = new Set();
    byInterval.set(interval, names);
  }
  names.add(name);
}

/**
 * Cross-reference shift assignments against projected date index.
 * Returns planUuid → intervalType → sorted name list.
 */
export function buildAssignmentLookup(
  items: TpmShiftAssignment[],
  idx: Map<string, Set<IntervalType>>,
): Map<string, Map<IntervalType, string[]>> {
  const map = new Map<string, Map<IntervalType, Set<string>>>();

  for (const a of items) {
    const intervals = idx.get(`${a.planUuid}:${a.shiftDate}`);
    if (intervals === undefined) continue;
    const name = `${a.lastName}, ${a.firstName}`;
    for (const interval of intervals) {
      addName(map, a.planUuid, interval, name);
    }
  }

  const result = new Map<string, Map<IntervalType, string[]>>();
  for (const [planUuid, byInterval] of map) {
    const sorted = new Map<IntervalType, string[]>();
    for (const [interval, nameSet] of byInterval) {
      sorted.set(interval, [...nameSet].sort());
    }
    result.set(planUuid, sorted);
  }
  return result;
}

// =============================================================================
// Assignment Count Aggregation
// =============================================================================

/** Per-employee TPM assignment count across interval types */
export interface TpmAssignmentCount {
  userId: number;
  firstName: string;
  lastName: string;
  counts: Partial<Record<IntervalType, number>>;
  total: number;
}

/** Internal accumulator for count aggregation */
interface CountAccumulator {
  fn: string;
  ln: string;
  perInterval: Map<IntervalType, number>;
  total: number;
}

/** Ensure user entry exists in map, return it */
function getOrCreateEntry(
  map: Map<number, CountAccumulator>,
  a: TpmShiftAssignment,
): CountAccumulator {
  let entry = map.get(a.userId);
  if (entry === undefined) {
    entry = {
      fn: a.firstName,
      ln: a.lastName,
      perInterval: new Map(),
      total: 0,
    };
    map.set(a.userId, entry);
  }
  return entry;
}

/**
 * Count TPM date assignments per employee per interval type.
 * Cross-references shift assignments with the projected date index
 * to determine how many date cells each employee covers per interval.
 */
export function buildAssignmentCounts(
  items: TpmShiftAssignment[],
  dateIndex: Map<string, Set<IntervalType>>,
): TpmAssignmentCount[] {
  const seen = new Set<string>();
  const map = new Map<number, CountAccumulator>();

  for (const a of items) {
    const intervals = dateIndex.get(`${a.planUuid}:${a.shiftDate}`);
    if (intervals === undefined) continue;

    for (const interval of intervals) {
      const key = `${a.userId}:${a.planUuid}:${a.shiftDate}:${interval}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const entry = getOrCreateEntry(map, a);
      entry.perInterval.set(interval, (entry.perInterval.get(interval) ?? 0) + 1);
      entry.total++;
    }
  }

  return toSortedCounts(map);
}

/** Convert internal map to sorted TpmAssignmentCount array */
function toSortedCounts(map: Map<number, CountAccumulator>): TpmAssignmentCount[] {
  const result: TpmAssignmentCount[] = [];
  for (const [userId, d] of map) {
    const counts: Partial<Record<IntervalType, number>> = {};
    for (const col of INTERVAL_COLUMNS) {
      const v = d.perInterval.get(col);
      if (v !== undefined) counts[col] = v;
    }
    result.push({
      userId,
      firstName: d.fn,
      lastName: d.ln,
      counts,
      total: d.total,
    });
  }
  return result.sort((a: TpmAssignmentCount, b: TpmAssignmentCount): number =>
    `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`, 'de'),
  );
}
