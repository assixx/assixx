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
  carryOverDeadlineMonth: 'Übertragungsfrist',
  carryOverDeadlineDay: 'Übertragungsfrist (Tag)',
  advanceNoticeDays: 'Vorlaufzeit (Tage)',
  maxConsecutiveDays: 'Max. aufeinanderfolgende Tage',
};

/** Tooltip descriptions for each settings field */
export const SETTINGS_TOOLTIPS: Record<string, string> = {
  defaultAnnualDays:
    'Anzahl der Urlaubstage, die jedem neuen Mitarbeiter pro Jahr standardmäßig zustehen.',
  maxCarryOverDays:
    'Maximale Anzahl nicht genutzter Urlaubstage, die ins nächste Jahr übertragen werden dürfen.',
  carryOverDeadlineMonth:
    'Stichtag, bis zu dem übertragene Urlaubstage aus dem Vorjahr genommen werden müssen. Danach verfallen sie.',
  carryOverDeadlineDay: 'Tag des Monats für den Übertragungsstichtag.',
  advanceNoticeDays:
    'Mindestanzahl an Tagen, die ein Urlaubsantrag vor dem gewünschten Startdatum eingereicht werden muss.',
  maxConsecutiveDays:
    'Maximale Anzahl aufeinanderfolgender Urlaubstage, die am Stück genommen werden dürfen. Leer = unbegrenzt.',
};
