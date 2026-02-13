/**
 * Vacation Rules — Constants & Labels (German)
 */

// ─── Month labels for carry-over deadline ───────────────────────────

export const MONTH_LABELS: Record<number, string> = {
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

/** Dropdown options for carry-over deadline month */
export const MONTH_DROPDOWN_OPTIONS: { value: number; label: string }[] =
  Object.entries(MONTH_LABELS).map(([num, name]) => ({
    value: Number(num),
    label: name,
  }));

// ─── Tab navigation ─────────────────────────────────────────────────

export type RulesTab = 'blackouts' | 'staffing-rules' | 'settings';

export const RULES_TABS: { value: RulesTab; label: string; icon: string }[] = [
  { value: 'blackouts', label: 'Sperrzeiten', icon: 'fas fa-ban' },
  {
    value: 'staffing-rules',
    label: 'Besetzungsregeln',
    icon: 'fas fa-users-cog',
  },
  { value: 'settings', label: 'Einstellungen', icon: 'fas fa-cog' },
];

// ─── Settings field labels ──────────────────────────────────────────

export const SETTINGS_LABELS: Record<string, string> = {
  defaultAnnualDays: 'Standard-Jahresurlaub (Tage)',
  maxCarryOverDays: 'Max. Übertragbare Tage',
  carryOverDeadlineMonth: 'Übertragungsfrist (Monat)',
  carryOverDeadlineDay: 'Übertragungsfrist (Tag)',
  advanceNoticeDays: 'Vorlaufzeit (Tage)',
  maxConsecutiveDays: 'Max. aufeinanderfolgende Tage',
};
