/**
 * Vacation Holidays — Constants & Labels (German)
 */

// ─── Recurring labels ───────────────────────────────────────────────

export const RECURRING_LABELS: Record<string, string> = {
  true: 'Jaehrlich wiederkehrend',
  false: 'Einmalig',
};

// ─── Default German holidays (for reference / seed button) ──────────

export const DEFAULT_GERMAN_HOLIDAYS: {
  name: string;
  date: string;
  recurring: boolean;
}[] = [
  { name: 'Neujahr', date: '01-01', recurring: true },
  { name: 'Tag der Arbeit', date: '05-01', recurring: true },
  { name: 'Tag der Deutschen Einheit', date: '10-03', recurring: true },
  { name: '1. Weihnachtsfeiertag', date: '12-25', recurring: true },
  { name: '2. Weihnachtsfeiertag', date: '12-26', recurring: true },
];
