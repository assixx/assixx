/**
 * Pure helper functions for SlotAssistant.svelte
 * Extracted to keep the component under the 850-line ESLint limit.
 *
 * All functions here are stateless — no Svelte runes or reactive state.
 */
import { INTERVAL_LABELS, MESSAGES } from '../../../_admin/constants';
import { getISOWeek, timestampToISO, weekOfMonth } from '../../../_admin/date-helpers';

import type {
  DayAvailability,
  IntervalType,
  ProjectedSlot,
  ScheduleProjectionResult,
  TpmPlanAssignment,
} from '../../../_admin/types';

// =========================================================================
// CONSTANTS
// =========================================================================

export const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Month period for multi-month intervals (absent = fires every month) */
export const INTERVAL_MONTH_PERIOD: Partial<Record<IntervalType, number>> = {
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

// =========================================================================
// TYPES
// =========================================================================

export interface CalendarRow {
  kw: number;
  monthLabel: string;
  cells: (DayAvailability | null)[];
}

// =========================================================================
// GENERIC UTILITIES
// =========================================================================

/** Group items by a string key into a Map<key, items[]> */
export function buildLookupMap<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (existing !== undefined) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

// =========================================================================
// DATE / FORMATTING HELPERS
// =========================================================================

/** Convert JS getDay() (Sun=0) to ISO weekday index (Mon=0, Sun=6) */
export function isoWeekday(dateStr: string): number {
  const jsDay = new Date(dateStr).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function formatDayMonth(dateStr: string, withYear: boolean): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
  };
  if (withYear) opts.year = '2-digit';
  return new Date(dateStr).toLocaleDateString('de-DE', opts);
}

// =========================================================================
// CONFLICT HELPERS
// =========================================================================

export function getConflictLabel(type: string): string {
  if (type === 'no_shift_plan') return MESSAGES.SLOT_NO_SHIFT;
  if (type === 'existing_tpm') return MESSAGES.SLOT_TPM_EXISTING;
  if (type === 'tpm_schedule') return MESSAGES.SLOT_TPM_SCHEDULE;
  return type;
}

export function getConflictIcon(type: string): string {
  if (type === 'no_shift_plan') return 'fa-calendar-xmark';
  if (type === 'existing_tpm') return 'fa-clipboard-check';
  if (type === 'tpm_schedule') return 'fa-clock';
  return 'fa-exclamation';
}

export function hasTpmScheduleConflict(day: DayAvailability): boolean {
  return day.conflicts.some((c) => c.type === 'tpm_schedule');
}

// =========================================================================
// PROJECTION HELPERS
// =========================================================================

export function formatProjectionDescription(slot: ProjectedSlot): string {
  const intervals = slot.intervalTypes.map((t: IntervalType) => INTERVAL_LABELS[t]).join(', ');
  const time = slot.isFullDay ? 'Ganztägig' : `${slot.startTime ?? '?'} – ${slot.endTime ?? '?'}`;
  return `${slot.planName} (${slot.assetName}) — ${intervals} — ${time}`;
}

function formatProjectionLines(slots: ProjectedSlot[]): string[] {
  return slots.map((s: ProjectedSlot) => formatProjectionDescription(s));
}

function collectConflictParts(day: DayAvailability): string[] {
  return day.conflicts.map((c) =>
    c.type === 'tpm_schedule' ? c.description : `${getConflictLabel(c.type)}: ${c.description}`,
  );
}

function appendUniqueProjections(
  parts: string[],
  projSlots: ProjectedSlot[],
  conflictDescs: Set<string>,
): void {
  for (const s of projSlots) {
    const desc = formatProjectionDescription(s);
    if (!conflictDescs.has(desc)) {
      parts.push(desc);
    }
  }
}

/** Build tooltip from slot data + projection enrichment */
export function buildDayTooltip(day: DayAvailability, projSlots: ProjectedSlot[]): string {
  if (day.isAvailable) {
    if (projSlots.length === 0) return 'Verfügbar';
    const lines = formatProjectionLines(projSlots);
    return `Verfügbar\n\nGeplante Termine:\n${lines.join('\n')}`;
  }

  const parts = collectConflictParts(day);
  const conflictDescs = new Set(day.conflicts.map((c) => c.description));
  appendUniqueProjections(parts, projSlots, conflictDescs);
  return parts.join('\n');
}

// =========================================================================
// INTERVAL HELPERS
// =========================================================================

/** Extract interval reference months from projection data for the current plan */
export function extractIntervalRefs(
  proj: ScheduleProjectionResult,
  uuid: string,
): Map<IntervalType, number> {
  const refs = new Map<IntervalType, number>();
  for (const slot of proj.slots) {
    if (slot.planUuid !== uuid) continue;
    const m = new Date(slot.date).getMonth();
    for (const t of slot.intervalTypes) {
      if (!refs.has(t)) refs.set(t, m);
    }
  }
  return refs;
}

/** Compute which intervals fire for a given month based on reference months */
export function computeIntervalsForMonth(
  month: number,
  refs: Map<IntervalType, number>,
): IntervalType[] {
  const result: IntervalType[] = [];
  for (const [interval, refMonth] of refs) {
    const period = INTERVAL_MONTH_PERIOD[interval] ?? 1;
    if ((((month - refMonth) % period) + period) % period === 0) {
      result.push(interval);
    }
  }
  return result;
}

// =========================================================================
// CALENDAR ROW HELPERS
// =========================================================================

export function buildCalendarRow(days: DayAvailability[], kw: number, cols: number): CalendarRow {
  const wd = isoWeekday(days[0].date);
  const cells: (DayAvailability | null)[] = [...(Array(wd).fill(null) as null[]), ...days];
  while (cells.length < cols) cells.push(null);
  return { kw, monthLabel: '', cells };
}

export function applyMonthLabels(rows: CalendarRow[]): void {
  let lastMonthKey = -1;
  for (const row of rows) {
    const firstDay = row.cells.find((c): c is DayAvailability => c !== null);
    if (firstDay === undefined) continue;
    const d = new Date(firstDay.date);
    const monthKey = d.getFullYear() * 12 + d.getMonth();
    if (monthKey !== lastMonthKey) {
      row.monthLabel = d.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });
      lastMonthKey = monthKey;
    }
  }
}

/** Group visible days into calendar rows by ISO week + month boundary */
export function computeCalendarRows(days: DayAvailability[], headerCount: number): CalendarRow[] {
  if (days.length === 0) return [];
  const rows: CalendarRow[] = [];
  let batch: DayAvailability[] = [];
  let batchKw = getISOWeek(days[0].date);
  let batchMonth = new Date(days[0].date).getMonth();

  for (const day of days) {
    const kw = getISOWeek(day.date);
    const month = new Date(day.date).getMonth();
    if ((kw !== batchKw || month !== batchMonth) && batch.length > 0) {
      rows.push(buildCalendarRow(batch, batchKw, headerCount));
      batch = [];
    }
    batchKw = kw;
    batchMonth = month;
    batch.push(day);
  }
  if (batch.length > 0) {
    rows.push(buildCalendarRow(batch, batchKw, headerCount));
  }

  applyMonthLabels(rows);
  return rows;
}

// =========================================================================
// COMPOSITE COMPUTATIONS
// =========================================================================

/** Merge slot days with projection-only days beyond the 90-day slot limit */
export function mergeCalendarDays(
  slotDays: DayAvailability[],
  rangeExceedsSlotLimit: boolean,
  endDateStr: string,
  slotEndDateStr: string,
  projByDate: Map<string, ProjectedSlot[]>,
): DayAvailability[] {
  if (!rangeExceedsSlotLimit) return slotDays;

  const coveredDates = new Set(slotDays.map((d: DayAvailability) => d.date));
  const extraDays: DayAvailability[] = [];
  const endMs = new Date(endDateStr).getTime();
  const dayMs = 86_400_000;
  let curMs = new Date(slotEndDateStr).getTime() + dayMs;

  while (curMs <= endMs) {
    const dateStr = timestampToISO(curMs);
    if (!coveredDates.has(dateStr)) {
      const projSlots = projByDate.get(dateStr);
      const hasSchedule = projSlots !== undefined && projSlots.length > 0;
      extraDays.push({
        date: dateStr,
        isAvailable: !hasSchedule,
        conflicts:
          hasSchedule ?
            projSlots.map((s: ProjectedSlot) => ({
              type: 'tpm_schedule' as const,
              description: formatProjectionDescription(s),
            }))
          : [],
      });
    }
    curMs += dayMs;
  }

  return [...slotDays, ...extraDays];
}

// =========================================================================
// ASSIGNMENT COUNT HELPERS (used by EmployeeAssignment)
// =========================================================================

/** Interval columns in display order (no daily/weekly) */
export const COUNT_INTERVAL_COLUMNS: IntervalType[] = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
];

/** Per-employee TPM assignment count across interval types */
export interface AssignmentCount {
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

/** Build date → interval types map for a specific plan */
export function buildDateIntervalMap(
  slots: ProjectedSlot[],
  forPlanUuid: string,
): Map<string, Set<IntervalType>> {
  const map = new Map<string, Set<IntervalType>>();
  for (const slot of slots) {
    if (slot.planUuid !== forPlanUuid) continue;
    let set = map.get(slot.date);
    if (set === undefined) {
      set = new Set();
      map.set(slot.date, set);
    }
    for (const interval of slot.intervalTypes) {
      set.add(interval);
    }
  }
  return map;
}

/** Process one assignment's intervals — extracted for cognitive complexity */
function processIntervals(
  a: TpmPlanAssignment,
  intervals: Set<IntervalType>,
  seen: Set<string>,
  map: Map<number, CountAccumulator>,
): void {
  for (const interval of intervals) {
    const key = `${a.userId}:${a.scheduledDate}:${interval}`;
    if (seen.has(key)) continue;
    seen.add(key);

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
    entry.perInterval.set(interval, (entry.perInterval.get(interval) ?? 0) + 1);
    entry.total++;
  }
}

/** Convert accumulator map to sorted AssignmentCount array */
function toSortedAssignmentCounts(map: Map<number, CountAccumulator>): AssignmentCount[] {
  const result: AssignmentCount[] = [];
  for (const [userId, d] of map) {
    const counts: Partial<Record<IntervalType, number>> = {};
    for (const col of COUNT_INTERVAL_COLUMNS) {
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
  return result.sort((a: AssignmentCount, b: AssignmentCount): number =>
    `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`, 'de'),
  );
}

/** Aggregate assignment counts per employee per interval type */
export function buildPlanAssignmentCounts(
  assigns: TpmPlanAssignment[],
  dateIntervals: Map<string, Set<IntervalType>>,
): AssignmentCount[] {
  const seen = new Set<string>();
  const map = new Map<number, CountAccumulator>();

  for (const a of assigns) {
    const intervals = dateIntervals.get(a.scheduledDate);
    if (intervals === undefined) continue;
    processIntervals(a, intervals, seen, map);
  }

  return toSortedAssignmentCounts(map);
}

// =========================================================================
// COMPOSITE COMPUTATIONS
// =========================================================================

/** Compute preview dates + their interval badges for a given weekday/repeat pattern */
export function computePreviewData(
  previewWeekday: number | undefined,
  previewRepeatEvery: number | undefined,
  days: DayAvailability[],
  projData: ScheduleProjectionResult | null,
  planUuid: string | undefined,
): { dates: Set<string>; intervals: Map<string, IntervalType[]> } {
  const dates = new Set<string>();
  const intervals = new Map<string, IntervalType[]>();

  if (previewWeekday === undefined || previewRepeatEvery === undefined) {
    return { dates, intervals };
  }

  const refs =
    projData !== null && planUuid !== undefined ?
      extractIntervalRefs(projData, planUuid)
    : new Map<IntervalType, number>();

  for (const day of days) {
    if (isoWeekday(day.date) !== previewWeekday || weekOfMonth(day.date) !== previewRepeatEvery) {
      continue;
    }
    dates.add(day.date);
    if (refs.size > 0) {
      const month = new Date(day.date).getMonth();
      intervals.set(day.date, computeIntervalsForMonth(month, refs));
    }
  }

  return { dates, intervals };
}
