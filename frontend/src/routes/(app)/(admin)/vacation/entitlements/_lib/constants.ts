/**
 * Vacation Entitlements — Constants & Labels (German)
 */

// ─── Balance field labels ───────────────────────────────────────────

export const BALANCE_LABELS: Record<string, string> = {
  totalDays: 'Jahresurlaub',
  carriedOverDays: 'Uebertrag',
  effectiveCarriedOver: 'Eff. Uebertrag',
  additionalDays: 'Zusatztage',
  availableDays: 'Verfuegbar gesamt',
  usedDays: 'Genommen',
  pendingDays: 'Beantragt',
  remainingDays: 'Verbleibend',
  projectedRemaining: 'Prognose',
};

// ─── Entitlement form field labels ──────────────────────────────────

export const ENTITLEMENT_LABELS: Record<string, string> = {
  totalDays: 'Jahresurlaub (Tage)',
  carriedOverDays: 'Uebertragene Tage',
  additionalDays: 'Zusaetzliche Tage',
  carryOverExpiresAt: 'Uebertrag verfaellt am',
};

// ─── Default page size for employee list ────────────────────────────

export const EMPLOYEES_PAGE_SIZE = 100;
