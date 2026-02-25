// =============================================================================
// Gesamtansicht - Matrix Utility Functions
// =============================================================================

import type { TpmPlan, ProjectedSlot, IntervalType } from '../../_lib/types';

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

/** Format plan base time for display */
export function formatTime(baseTime: string | null): string {
  if (baseTime === null || baseTime.trim().length === 0) return '';
  return baseTime.substring(0, 5);
}
