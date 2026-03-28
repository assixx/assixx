/**
 * TPM Cards Helpers — Pure functions for mapping and query building
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 */
import {
  type FieldMapping,
  type SetClauseResult,
  buildSetClause,
  toIsoString,
} from '../../utils/db-helpers.js';
import type { TpmCard, TpmCardCategory, TpmCardRow } from './tpm.types.js';

/**
 * Parse a PostgreSQL array literal string into a JS array.
 * pg returns custom ENUM arrays as strings: '{reinigung,wartung}' → ['reinigung','wartung'].
 * Also handles already-parsed JS arrays (no-op).
 */
function parsePgCategoryArray(value: unknown): TpmCardCategory[] {
  if (Array.isArray(value)) return value as TpmCardCategory[];
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (trimmed === '{}' || trimmed === '') return [];
  const inner = trimmed.slice(1, -1);
  return inner.split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')) as TpmCardCategory[];
}

/** Extended row type including JOIN columns from related tables */
export interface TpmCardJoinRow extends TpmCardRow {
  asset_name?: string;
  plan_uuid?: string;
  created_by_name?: string;
  last_completed_by_name?: string;
}

/** Map database row to API response */
export function mapCardRowToApi(row: TpmCardJoinRow): TpmCard {
  const card: TpmCard = {
    uuid: row.uuid.trim(),
    assetId: row.asset_id,
    cardCode: row.card_code,
    cardRole: row.card_role,
    intervalType: row.interval_type,
    intervalOrder: row.interval_order,
    title: row.title,
    description: row.description,
    locationDescription: row.location_description,
    locationPhotoUrl: row.location_photo_url,
    requiresApproval: row.requires_approval,
    status: row.status,
    currentDueDate: row.current_due_date,
    lastCompletedAt: row.last_completed_at,
    lastCompletedBy: row.last_completed_by,
    sortOrder: row.sort_order,
    customFields: row.custom_fields,
    customIntervalDays: row.custom_interval_days,
    weekdayOverride: row.weekday_override,
    estimatedExecutionMinutes: row.estimated_execution_minutes,
    cardCategories: parsePgCategoryArray(row.card_categories),
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };

  // Optional properties: only set when JOIN data is present
  if (row.plan_uuid !== undefined) card.planUuid = row.plan_uuid.trim();
  if (row.asset_name !== undefined) card.assetName = row.asset_name;
  if (row.created_by_name !== undefined) card.createdByName = row.created_by_name;
  if (row.last_completed_by_name !== undefined) {
    card.lastCompletedByName = row.last_completed_by_name;
  }

  return card;
}

/** Field mappings for card update: [apiField, dbColumn] */
const CARD_UPDATE_MAPPINGS: readonly FieldMapping[] = [
  ['cardRole', 'card_role'],
  ['intervalType', 'interval_type'],
  ['title', 'title'],
  ['description', 'description'],
  ['locationDescription', 'location_description'],
  ['requiresApproval', 'requires_approval'],
  ['customIntervalDays', 'custom_interval_days'],
  ['weekdayOverride', 'weekday_override'],
  ['estimatedExecutionMinutes', 'estimated_execution_minutes'],
  ['cardCategories', 'card_categories'],
];

/** Build SET clause for card update — only includes provided fields */
export function buildCardUpdateFields(dto: Record<string, unknown>): SetClauseResult {
  return buildSetClause(dto, CARD_UPDATE_MAPPINGS);
}
