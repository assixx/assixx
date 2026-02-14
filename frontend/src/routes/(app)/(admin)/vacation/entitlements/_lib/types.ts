/**
 * Vacation Entitlements — Frontend Type Definitions
 * Mirrors backend vacation.types.ts for entitlements + balance.
 */

// ─── API response types ─────────────────────────────────────────────

export interface VacationEntitlement {
  id: string;
  userId: number;
  year: number;
  totalDays: number;
  carriedOverDays: number;
  additionalDays: number;
  carryOverExpiresAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface VacationBalance {
  year: number;
  totalDays: number;
  carriedOverDays: number;
  effectiveCarriedOver: number;
  additionalDays: number;
  availableDays: number;
  usedDays: number;
  remainingDays: number;
  pendingDays: number;
  projectedRemaining: number;
}

/** Simplified employee info for the entitlements list */
export interface EmployeeListItem {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  position: string | null;
  employeeNumber?: string;
  teamNames?: string[];
}

// ─── Create / Update payloads ───────────────────────────────────────

export interface CreateEntitlementPayload {
  userId: number;
  year: number;
  totalDays: number;
  carriedOverDays: number;
  additionalDays: number;
  carryOverExpiresAt?: string;
}

export interface AddDaysPayload {
  year: number;
  days: number;
}

// ─── SSR page data ──────────────────────────────────────────────────

export interface VacationEntitlementsPageData {
  employees: EmployeeListItem[];
  currentYear: number;
}
