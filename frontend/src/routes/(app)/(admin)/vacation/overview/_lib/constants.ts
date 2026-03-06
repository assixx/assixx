/**
 * Vacation Overview — Constants & Labels (German)
 */

// ─── Month names ─────────────────────────────────────────────────

export const MONTH_NAMES: Record<number, string> = {
  1: 'Januar',
  2: 'Februar',
  3: 'März',
  4: 'April',
  5: 'Mai',
  6: 'Juni',
  7: 'Juli',
  8: 'August',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Dezember',
};

// ─── Short month names (year overview column headers) ────────────

export const MONTH_SHORT: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mär',
  4: 'Apr',
  5: 'Mai',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Okt',
  11: 'Nov',
  12: 'Dez',
};

// ─── Short weekday names ─────────────────────────────────────────

export const WEEKDAY_SHORT: Record<number, string> = {
  0: 'So',
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
};

// ─── Vacation type labels & colors ───────────────────────────────

export const TYPE_LABELS: Record<string, string> = {
  regular: 'Urlaub',
  unpaid: 'Unbezahlt',
};

export const TYPE_COLORS: Record<string, string> = {
  regular: 'var(--color-primary)',
  unpaid: 'var(--color-danger)',
};

// ─── Half-day labels ─────────────────────────────────────────────

export const HALF_DAY_LABELS: Record<string, string> = {
  none: 'Ganztag',
  morning: 'Vormittag',
  afternoon: 'Nachmittag',
};

// ─── Cascade dropdown placeholders ──────────────────────────────

export const DROPDOWN_PLACEHOLDERS = {
  TEAM: 'Team wählen...',
  YEAR: 'Jahr wählen...',
  MONTH: 'Monat wählen...',
  AWAIT_TEAM: 'Erst Team wählen...',
  AWAIT_YEAR: 'Erst Jahr wählen...',
} as const;
