/**
 * TPM Plans Helpers — Pure functions for mapping and query building
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 */
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

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
  approval_status?: string;
  approval_decision_note?: string;
  approval_decided_by_name?: string;
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
    notes: row.notes,
    revisionNumber: row.revision_number,
    approvalVersion: row.approval_version,
    revisionMinor: row.revision_minor,
    approvalStatus: row.approval_status?.trim() ?? null,
    approvalDecisionNote: row.approval_decision_note ?? null,
    approvalDecidedByName: row.approval_decided_by_name ?? null,
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
export const PLAN_UPDATE_MAPPINGS: readonly FieldMapping[] = [
  ['name', 'name'],
  ['baseWeekday', 'base_weekday'],
  ['baseRepeatEvery', 'base_repeat_every'],
  ['baseTime', 'base_time'],
  ['bufferHours', 'buffer_hours'],
  ['notes', 'notes'],
];

/** Build SET clause for plan update — only includes provided fields */
export function buildPlanUpdateFields(dto: Record<string, unknown>): SetClauseResult {
  return buildSetClause(dto, PLAN_UPDATE_MAPPINGS);
}

/** Normalize values for comparison: TIME '14:00:00' → '14:00', NUMERIC '4.0' → 4 */
function normalizeForComparison(val: unknown): unknown {
  if (val === null) return null;
  // TIME: PostgreSQL returns 'HH:MM:SS', DTO sends 'HH:MM'
  if (typeof val === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
    return val.slice(0, 5);
  }
  // NUMERIC: pg returns string '4.0', DTO sends number 4
  if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) {
    return Number(val);
  }
  return val;
}

/**
 * Detect which plan fields actually changed between old DB state and new DTO values.
 * Returns snake_case DB column names (e.g. ['base_weekday', 'base_time']).
 * Uses PLAN_UPDATE_MAPPINGS to bridge camelCase DTO ↔ snake_case DB.
 */
export function detectChangedFields(
  oldState: TpmMaintenancePlanRow,
  newValues: Record<string, unknown>,
): string[] {
  const changed: string[] = [];

  for (const [apiField, dbColumn] of PLAN_UPDATE_MAPPINGS) {
    if (!(apiField in newValues)) continue;

    const oldVal = oldState[dbColumn as keyof TpmMaintenancePlanRow];
    const newVal = newValues[apiField];

    // Normalize: treat null/undefined as equivalent
    const oldNorm = normalizeForComparison(oldVal ?? null);
    const newNorm = normalizeForComparison(newVal ?? null);

    if (JSON.stringify(oldNorm) !== JSON.stringify(newNorm)) {
      changed.push(dbColumn);
    }
  }

  return changed;
}

/** Insert a revision snapshot into tpm_plan_revisions within an existing transaction */
export async function insertRevisionSnapshot(
  client: PoolClient,
  tenantId: number,
  row: TpmMaintenancePlanRow,
  revisionNumber: number,
  approvalVersion: number,
  revisionMinor: number,
  changedBy: number,
  changeReason: string | null,
  changedFields: string[],
): Promise<void> {
  await client.query(
    `INSERT INTO tpm_plan_revisions
       (uuid, tenant_id, plan_id, revision_number, approval_version, revision_minor,
        name, asset_id, base_weekday, base_repeat_every, base_time,
        buffer_hours, notes,
        changed_by, change_reason, changed_fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      uuidv7(),
      tenantId,
      row.id,
      revisionNumber,
      approvalVersion,
      revisionMinor,
      row.name,
      row.asset_id,
      row.base_weekday,
      row.base_repeat_every,
      row.base_time,
      row.buffer_hours,
      row.notes,
      changedBy,
      changeReason,
      changedFields,
    ],
  );
}
