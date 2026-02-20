// =============================================================================
// TPM - DATE HELPERS (non-reactive, pure functions)
// =============================================================================

/** 4 weeks in milliseconds */
export const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/** 90 days in milliseconds (backend MAX_RANGE_DAYS limit) */
export const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Convert a Unix timestamp (ms) to ISO date string YYYY-MM-DD */
export function timestampToISO(ms: number): string {
  return new Date(ms).toISOString().split('T')[0] ?? '';
}
