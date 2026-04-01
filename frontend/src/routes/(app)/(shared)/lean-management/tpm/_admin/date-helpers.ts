// =============================================================================
// TPM - DATE HELPERS (non-reactive, pure functions)
// =============================================================================

/** 4 weeks in milliseconds */
export const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/** 90 days in milliseconds (default range for slot assistant) */
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** 89 days offset in ms — start + 89 = 90 days inclusive (backend MAX_RANGE_DAYS limit) */
export const MAX_RANGE_MS = 89 * 24 * 60 * 60 * 1000;

/** 364 days offset in ms — start + 364 = 365 days inclusive (schedule projection limit) */
export const MAX_RANGE_365_MS = 364 * 24 * 60 * 60 * 1000;

/** Convert a Unix timestamp (ms) to ISO date string YYYY-MM-DD */
export function timestampToISO(ms: number): string {
  return new Date(ms).toISOString().split('T')[0] ?? '';
}

/** ISO 8601 week number (Kalenderwoche) */
export function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Nth occurrence of this weekday in its month (1–5) */
export function weekOfMonth(dateStr: string): number {
  return Math.ceil(new Date(dateStr).getDate() / 7);
}
