/**
 * TPM Plans Helpers — Pure functions for mapping and query building
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 */
import type { TpmMaintenancePlanRow, TpmPlan } from './tpm.types.js';

/** Extended row type including JOIN columns from related tables */
export interface TpmPlanJoinRow extends TpmMaintenancePlanRow {
  machine_name?: string;
  created_by_name?: string;
}

/** Map database row to API response */
export function mapPlanRowToApi(row: TpmPlanJoinRow): TpmPlan {
  const plan: TpmPlan = {
    uuid: row.uuid.trim(),
    machineId: row.machine_id,
    name: row.name,
    baseWeekday: row.base_weekday,
    baseRepeatEvery: row.base_repeat_every,
    baseTime: row.base_time,
    shiftPlanRequired: row.shift_plan_required,
    notes: row.notes,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : new Date(row.updated_at).toISOString(),
  };

  // Optional properties: only set when JOIN data is present
  if (row.machine_name !== undefined) plan.machineName = row.machine_name;
  if (row.created_by_name !== undefined)
    plan.createdByName = row.created_by_name;

  return plan;
}

/** Field mappings for plan update: [apiField, dbColumn] */
const PLAN_UPDATE_MAPPINGS: readonly [string, string][] = [
  ['name', 'name'],
  ['baseWeekday', 'base_weekday'],
  ['baseRepeatEvery', 'base_repeat_every'],
  ['baseTime', 'base_time'],
  ['shiftPlanRequired', 'shift_plan_required'],
  ['notes', 'notes'],
] as const;

/** Build SET clause for plan update — only includes provided fields */
export function buildPlanUpdateFields(dto: Record<string, unknown>): {
  setClauses: string[];
  params: unknown[];
  nextParamIndex: number;
} {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const [apiField, dbColumn] of PLAN_UPDATE_MAPPINGS) {
    if (dto[apiField] !== undefined) {
      setClauses.push(`${dbColumn} = $${paramIndex}`);
      params.push(dto[apiField]);
      paramIndex++;
    }
  }

  return { setClauses, params, nextParamIndex: paramIndex };
}
