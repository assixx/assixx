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
