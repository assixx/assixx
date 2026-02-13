/**
 * Vacation Rules — Constants & Labels (German)
 */
import type { BlackoutScopeType } from './types';

// ─── Scope type labels ──────────────────────────────────────────────

export const SCOPE_TYPE_LABELS: Record<BlackoutScopeType, string> = {
  global: 'Global',
  team: 'Team',
  department: 'Abteilung',
};

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

// ─── Month labels for carry-over deadline ───────────────────────────

export const MONTH_LABELS: Record<number, string> = {
  1: 'Januar',
  2: 'Februar',
  3: 'Maerz',
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

// ─── Settings field labels ──────────────────────────────────────────

export const SETTINGS_LABELS: Record<string, string> = {
  defaultAnnualDays: 'Standard-Jahresurlaub (Tage)',
  maxCarryOverDays: 'Max. Uebertragbare Tage',
  carryOverDeadlineMonth: 'Uebertragungsfrist (Monat)',
  carryOverDeadlineDay: 'Uebertragungsfrist (Tag)',
  advanceNoticeDays: 'Vorlaufzeit (Tage)',
  maxConsecutiveDays: 'Max. aufeinanderfolgende Tage',
};
