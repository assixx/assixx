/**
 * Inventory Module Types
 *
 * DB row types (snake_case) and application types (camelCase)
 * for the inventory addon.
 */

// ── Enums (must match DB ENUMs) ─────────────────────────────────

export type InventoryItemStatus =
  | 'operational'
  | 'defective'
  | 'repair'
  | 'maintenance'
  | 'decommissioned'
  | 'removed'
  | 'stored';

export type InventoryFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

// ── DB Row Types (snake_case, match PostgreSQL columns) ─────────

export interface InventoryListRow {
  id: string;
  tenant_id: number;
  title: string;
  description: string | null;
  code_prefix: string;
  code_separator: string;
  code_digits: number;
  next_number: number;
  icon: string | null;
  is_active: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryTagRow {
  id: string;
  tenant_id: number;
  name: string;
  icon: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryTagWithUsageRow extends InventoryTagRow {
  usage_count: string;
}

export interface InventoryItemRow {
  id: string;
  tenant_id: number;
  list_id: string;
  code: string;
  name: string;
  description: string | null;
  status: InventoryItemStatus;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_of_manufacture: number | null;
  notes: string | null;
  responsible_user_id: number | null;
  last_inspection_date: Date | null;
  next_inspection_date: Date | null;
  inspection_interval: string | null;
  is_active: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  /** First photo path (populated by findByList via lateral subquery) */
  thumbnail_path: string | null;
  /** Full name of the uploader (populated by findByList via users JOIN) */
  created_by_name: string | null;
}

export interface InventoryCustomFieldRow {
  id: string;
  tenant_id: number;
  list_id: string;
  field_name: string;
  field_type: InventoryFieldType;
  field_options: string[] | null;
  field_unit: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryCustomValueRow {
  id: string;
  tenant_id: number;
  item_id: string;
  field_id: string;
  value_text: string | null;
  value_number: string | null;
  value_date: Date | null;
  value_boolean: boolean | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryItemPhotoRow {
  id: string;
  tenant_id: number;
  item_id: string;
  file_path: string;
  caption: string | null;
  sort_order: number;
  is_active: number;
  created_by: number;
  created_at: Date;
}

// ── Application Types (camelCase, for API responses) ────────────

export interface InventoryTag {
  id: string;
  name: string;
  icon: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryTagWithUsage extends InventoryTag {
  usageCount: number;
}

export interface InventoryList {
  id: string;
  title: string;
  description: string | null;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  nextNumber: number;
  icon: string | null;
  isActive: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  tags: InventoryTag[];
}

export interface InventoryListWithCounts extends InventoryList {
  statusCounts: Record<InventoryItemStatus, number>;
  totalItems: number;
}

export interface InventoryItem {
  id: string;
  listId: string;
  code: string;
  name: string;
  description: string | null;
  status: InventoryItemStatus;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearOfManufacture: number | null;
  notes: string | null;
  responsibleUserId: number | null;
  lastInspectionDate: Date | null;
  nextInspectionDate: Date | null;
  inspectionInterval: string | null;
  isActive: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItemDetail extends InventoryItem {
  photos: InventoryItemPhoto[];
  customValues: InventoryCustomValueWithField[];
}

export interface InventoryCustomField {
  id: string;
  listId: string;
  fieldName: string;
  fieldType: InventoryFieldType;
  fieldOptions: string[] | null;
  fieldUnit: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface InventoryCustomValueWithField {
  fieldId: string;
  fieldName: string;
  fieldType: InventoryFieldType;
  fieldUnit: string | null;
  isRequired: boolean;
  valueText: string | null;
  valueNumber: string | null;
  valueDate: Date | null;
  valueBoolean: boolean | null;
}

export interface InventoryItemPhoto {
  id: string;
  filePath: string;
  caption: string | null;
  sortOrder: number;
  createdBy: number;
  createdAt: Date;
  uploaderName: string | null;
}

// ── Row → Application Mappers ──────────────────────────────────

export function mapFieldRow(row: InventoryCustomFieldRow): InventoryCustomField {
  return {
    id: row.id,
    listId: row.list_id,
    fieldName: row.field_name,
    fieldType: row.field_type,
    fieldOptions: row.field_options,
    fieldUnit: row.field_unit,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
  };
}

export function mapTagRow(row: InventoryTagRow): InventoryTag {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTagWithUsageRow(row: InventoryTagWithUsageRow): InventoryTagWithUsage {
  return {
    ...mapTagRow(row),
    usageCount: Number(row.usage_count),
  };
}

// ── Constants ───────────────────────────────────────────────────

export const INVENTORY_ITEM_STATUSES: readonly InventoryItemStatus[] = [
  'operational',
  'defective',
  'repair',
  'maintenance',
  'decommissioned',
  'removed',
  'stored',
] as const;

export const STATUS_LABELS: Record<InventoryItemStatus, string> = {
  operational: 'In Betrieb',
  defective: 'Defekt',
  repair: 'In Reparatur',
  maintenance: 'In Wartung',
  decommissioned: 'Stillgelegt',
  removed: 'Entfernt',
  stored: 'Eingelagert',
};

export const MAX_CUSTOM_FIELDS_PER_LIST = 30;
export const MAX_PHOTOS_PER_ITEM = 20;
export const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_TAGS_PER_LIST = 10;
export const MAX_TAG_NAME_LENGTH = 50;
