/**
 * Vacation Rules — Frontend Type Definitions
 * Mirrors backend vacation.types.ts for blackouts, staffing rules, settings.
 */

// ─── Enums ──────────────────────────────────────────────────────────

export type BlackoutScopeType = 'global' | 'team' | 'department';

// ─── API response types ─────────────────────────────────────────────

export interface VacationBlackout {
  id: string;
  name: string;
  reason: string | null;
  startDate: string;
  endDate: string;
  scopeType: BlackoutScopeType;
  scopeId: number | null;
  scopeName?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface VacationStaffingRule {
  id: string;
  machineId: number;
  machineName?: string;
  minStaffCount: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface VacationSettings {
  id: string;
  defaultAnnualDays: number;
  maxCarryOverDays: number;
  carryOverDeadlineMonth: number;
  carryOverDeadlineDay: number;
  advanceNoticeDays: number;
  maxConsecutiveDays: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Create / Update payloads ───────────────────────────────────────

export interface CreateBlackoutPayload {
  name: string;
  reason?: string;
  startDate: string;
  endDate: string;
  scopeType: BlackoutScopeType;
  scopeId?: number;
}

export interface UpdateBlackoutPayload {
  name?: string;
  reason?: string | null;
  startDate?: string;
  endDate?: string;
  scopeType?: BlackoutScopeType;
  scopeId?: number | null;
}

export interface CreateStaffingRulePayload {
  machineId: number;
  minStaffCount: number;
}

export interface UpdateStaffingRulePayload {
  minStaffCount: number;
}

export interface UpdateSettingsPayload {
  defaultAnnualDays?: number;
  maxCarryOverDays?: number;
  carryOverDeadlineMonth?: number;
  carryOverDeadlineDay?: number;
  advanceNoticeDays?: number;
  maxConsecutiveDays?: number | null;
}

// ─── SSR page data ──────────────────────────────────────────────────

export interface VacationRulesPageData {
  blackouts: VacationBlackout[];
  staffingRules: VacationStaffingRule[];
  settings: VacationSettings | null;
}
