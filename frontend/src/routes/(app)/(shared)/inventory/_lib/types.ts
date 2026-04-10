// =============================================================================
// INVENTORY - TYPE DEFINITIONS
// =============================================================================

import type { FormIsActiveStatus, IsActiveStatus, StatusFilter } from '@assixx/shared';

export type { FormIsActiveStatus, IsActiveStatus, StatusFilter };

// ── Item Status (matches DB ENUM inventory_item_status) ────────

export type InventoryItemStatus =
  | 'operational'
  | 'defective'
  | 'repair'
  | 'maintenance'
  | 'decommissioned'
  | 'removed'
  | 'stored';

// ── Field Types (matches DB ENUM inventory_field_type) ─────────

export type InventoryFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

// ── Tag Types ──────────────────────────────────────────────────

/** A single inventory tag (label) */
export interface InventoryTag {
  id: string;
  name: string;
  icon: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

/** Tag enriched with how many lists currently reference it */
export interface InventoryTagWithUsage extends InventoryTag {
  usageCount: number;
}

// ── API Response Types ─────────────────────────────────────────

/** Inventory list with aggregated item status counts */
export interface InventoryList {
  id: string;
  title: string;
  description: string | null;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  nextNumber: number;
  icon: string | null;
  isActive: IsActiveStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  tags: InventoryTag[];
  statusCounts: Record<InventoryItemStatus, number>;
  totalItems: number;
}

/** Custom field definition for a list */
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

// ── Form Types ─────────────────────────────────────────────────

/** Form data for creating/editing a list */
export interface ListFormData {
  title: string;
  description: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: FormIsActiveStatus;
  tagIds: string[];
}

/** API payload for creating a list */
export interface CreateListPayload {
  title: string;
  description?: string;
  codePrefix: string;
  codeSeparator?: string;
  codeDigits?: number;
  icon?: string;
  tagIds?: string[];
}

/** API payload for updating a list */
export interface UpdateListPayload {
  title?: string;
  description?: string | null;
  codePrefix?: string;
  codeSeparator?: string;
  codeDigits?: number;
  icon?: string | null;
  isActive?: FormIsActiveStatus;
  tagIds?: string[];
}

/** API payload for creating/updating a tag */
export interface CreateTagPayload {
  name: string;
  icon?: string | null;
}

export interface UpdateTagPayload {
  name?: string;
  icon?: string | null;
}

// ── Item Types ────────────────────────────────────────────────

/** Single inventory item (snake_case from API) */
export interface InventoryItem {
  id: string;
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
  is_active: number;
  created_at: string;
  /** First photo path (from list view lateral subquery) */
  thumbnail_path: string | null;
}

/** Item detail with photos, custom values, and field definitions */
export interface InventoryItemDetail {
  item: InventoryItem & { list_title: string; list_code_prefix: string };
  photos: InventoryItemPhoto[];
  customValues: CustomValueWithField[];
  fields: InventoryCustomField[];
}

/** Payload for updating an item */
export interface UpdateItemPayload {
  name?: string;
  description?: string | null;
  status?: InventoryItemStatus;
  location?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  yearOfManufacture?: number | null;
  notes?: string | null;
  customValues?: CustomValueInput[];
}

/** Custom value input for create/update */
export interface CustomValueInput {
  fieldId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
}

export interface InventoryItemPhoto {
  id: string;
  filePath: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CustomValueWithField {
  fieldId: string;
  fieldName: string;
  fieldType: InventoryFieldType;
  fieldUnit: string | null;
  isRequired: boolean;
  valueText: string | null;
  valueNumber: string | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
}

/** Paginated items response with custom values */
export interface ItemsPage {
  items: InventoryItem[];
  total: number;
  customValuesByItem: Record<string, CustomValueWithField[]>;
}

/** Form data for creating/editing an item */
export interface ItemFormData {
  name: string;
  description: string;
  status: InventoryItemStatus;
  location: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  yearOfManufacture: string;
  notes: string;
}

// ── Badge Types ──────────────────────────────────────────────

export interface BadgeInfo {
  class: string;
  text: string;
  title: string;
}
