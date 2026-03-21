/**
 * TPM Plans Helpers — Pure functions for mapping and query building
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 */
import {
  type FieldMapping,
  type SetClauseResult,
  buildSetClause,
  toIsoString,
} from '../../utils/db-helpers.js';
import type { TpmMaintenancePlanRow, TpmPlan } from './tpm.types.js';

/** Extended row type including JOIN columns from related tables */
export interface TpmPlanJoinRow extends TpmMaintenancePlanRow {
  asset_uuid?: string;
  asset_name?: string;
  department_name?: string;
  created_by_name?: string;
}

/** Map database row to API response */
export function mapPlanRowToApi(row: TpmPlanJoinRow): TpmPlan {
  const plan: TpmPlan = {
    uuid: row.uuid.trim(),
    assetId: row.asset_id,
    name: row.name,
    baseWeekday: row.base_weekday,
    baseRepeatEvery: row.base_repeat_every,
    baseTime: row.base_time,
    bufferHours: Number(row.buffer_hours),
    shiftPlanRequired: row.shift_plan_required,
    notes: row.notes,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };

  // Optional properties: only set when JOIN data is present
  if (row.asset_uuid !== undefined) plan.assetUuid = row.asset_uuid.trim();
  if (row.asset_name !== undefined) plan.assetName = row.asset_name;
  if (row.department_name !== undefined) plan.departmentName = row.department_name;
  if (row.created_by_name !== undefined) plan.createdByName = row.created_by_name;

  return plan;
}

/** Field mappings for plan update: [apiField, dbColumn] */
const PLAN_UPDATE_MAPPINGS: readonly FieldMapping[] = [
  ['name', 'name'],
  ['baseWeekday', 'base_weekday'],
  ['baseRepeatEvery', 'base_repeat_every'],
  ['baseTime', 'base_time'],
  ['bufferHours', 'buffer_hours'],
  ['shiftPlanRequired', 'shift_plan_required'],
  ['notes', 'notes'],
];

/** Build SET clause for plan update — only includes provided fields */
export function buildPlanUpdateFields(dto: Record<string, unknown>): SetClauseResult {
  return buildSetClause(dto, PLAN_UPDATE_MAPPINGS);
}
