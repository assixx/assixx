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
  special_doctor: 'Arztbesuch',
  special_bereavement: 'Trauerfall',
  special_birth: 'Geburt',
  special_wedding: 'Hochzeit',
  special_move: 'Umzug',
  unpaid: 'Unbezahlt',
};

export const TYPE_COLORS: Record<string, string> = {
  regular: 'var(--color-primary)',
  special_doctor: '#00acc1',
  special_bereavement: 'var(--color-gray-500)',
  special_birth: 'var(--color-success)',
  special_wedding: 'var(--color-warning)',
  special_move: '#8e24aa',
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
  MACHINE: 'Maschine wählen...',
  TEAM: 'Team wählen...',
  YEAR: 'Jahr wählen...',
  MONTH: 'Monat wählen...',
  AWAIT_MACHINE: 'Erst Maschine wählen...',
  AWAIT_TEAM: 'Erst Team wählen...',
  AWAIT_YEAR: 'Erst Jahr wählen...',
  LOADING_TEAMS: 'Laden...',
} as const;
