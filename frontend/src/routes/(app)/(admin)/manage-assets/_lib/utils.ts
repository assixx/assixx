// =============================================================================
// MANAGE MACHINES - UTILITY FUNCTIONS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  MACHINE_TYPE_LABELS,
  MESSAGES,
  type AssetMessages,
} from './constants';

import type {
  Asset,
  AssetFormData,
  AssetStatus,
  AssetStatusFilter,
  AssetTeamInfo,
} from './types';

// =============================================================================
// BADGE DATA TYPES
// =============================================================================

/**
 * Badge data for rendering
 */
export interface BadgeData {
  class: string;
  text: string;
  tooltip: string;
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(status: AssetStatus): string {
  return STATUS_BADGE_CLASSES[status];
}

/**
 * Get localized status label
 */
export function getStatusLabel(status: AssetStatus): string {
  return STATUS_LABELS[status];
}

// =============================================================================
// BADGE HELPERS (for Table Display)
// =============================================================================

/**
 * Generate Teams badge data for table display
 * Following ASSIXX badge standard: count + tooltip with names
 */
export function getTeamsBadgeData(
  teams?: AssetTeamInfo[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): BadgeData {
  const teamList = teams ?? [];
  const count = teamList.length;
  const names = teamList.map((t) => t.name).join(', ');

  if (count === 0) {
    return {
      class: 'badge--secondary',
      text: 'Keine',
      tooltip: `Keine ${labels.team} zugewiesen`,
    };
  }

  return {
    class: 'badge--info',
    text: `${count} ${labels.team}`,
    tooltip: names,
  };
}

/**
 * Generate Area badge data for table display.
 * A asset always belongs to exactly 0 or 1 area — show the name directly.
 */
export function getAreaBadgeData(
  areaName?: string,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): BadgeData {
  if (areaName !== undefined && areaName !== '') {
    return {
      class: 'badge--info',
      text: areaName,
      tooltip: areaName,
    };
  }
  return {
    class: 'badge--secondary',
    text: 'Keine',
    tooltip: `Keine ${labels.area} zugewiesen`,
  };
}

/**
 * Generate Department badge data for table display.
 * A asset always belongs to exactly 0 or 1 department — show the name directly.
 */
export function getDepartmentBadgeData(
  departmentName?: string,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): BadgeData {
  if (departmentName !== undefined && departmentName !== '') {
    return {
      class: 'badge--info',
      text: departmentName,
      tooltip: departmentName,
    };
  }
  return {
    class: 'badge--secondary',
    text: 'Keine',
    tooltip: `Keine ${labels.department} zugewiesen`,
  };
}

// =============================================================================
// MACHINE TYPE HELPERS
// =============================================================================

/**
 * Get display name for asset type
 */
export function getAssetTypeLabel(type: string): string {
  return MACHINE_TYPE_LABELS[type] ?? type;
}

// =============================================================================
// MAINTENANCE HELPERS
// =============================================================================

/** Get maintenance warning status */
export function getMaintenanceWarningStatus(
  nextMaintenance?: string,
): 'overdue' | 'soon' | 'ok' | null {
  if (nextMaintenance === undefined || nextMaintenance === '') return null;

  const maintenanceDate = new Date(nextMaintenance);
  const today = new Date();
  const daysUntil = Math.floor(
    (maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntil < 0) {
    return 'overdue';
  } else if (daysUntil <= 7) {
    return 'soon';
  }
  return 'ok';
}

/**
 * Format date for German locale display
 */
export function formatDateDE(dateString?: string): string {
  if (dateString === undefined || dateString === '') return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE');
}

/**
 * Format date string to YYYY-MM-DD for HTML date input
 */
export function formatDateForInput(dateString?: string): string {
  if (dateString === undefined || dateString === '') return '';
  return new Date(dateString).toISOString().split('T')[0] ?? '';
}

/**
 * Format operating hours for display
 */
export function formatOperatingHours(hours?: number): string {
  if (hours === undefined || hours <= 0) return '-';
  return `${hours}h`;
}

// =============================================================================
// EMPTY STATE HELPERS
// =============================================================================

/**
 * Get empty state title based on filter
 */
export function getEmptyStateTitle(
  statusFilter: AssetStatusFilter,
  msgs: AssetMessages = MESSAGES,
): string {
  switch (statusFilter) {
    case 'operational':
      return msgs.EMPTY_OPERATIONAL;
    case 'maintenance':
      return msgs.EMPTY_MAINTENANCE;
    case 'repair':
      return msgs.EMPTY_REPAIR;
    case 'standby':
      return msgs.EMPTY_STANDBY;
    case 'cleaning':
      return msgs.EMPTY_CLEANING;
    case 'other':
      return msgs.EMPTY_OTHER;
    default:
      return msgs.EMPTY_TITLE;
  }
}

/**
 * Get empty state description based on filter
 */
export function getEmptyStateDescription(
  statusFilter: AssetStatusFilter,
  msgs: AssetMessages = MESSAGES,
): string {
  if (statusFilter !== 'all') {
    return msgs.EMPTY_FILTER_DESC;
  }
  return msgs.EMPTY_DESCRIPTION;
}

// =============================================================================
// FORM DATA BUILDER
// =============================================================================

export interface FormState {
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  departmentId: number | null;
  areaId: number | null;
  assetType: string;
  status: AssetStatus;
  operatingHours: number | null;
  nextMaintenance: string;
}

/**
 * Convert operatingHours to integer (runtime defense for string inputs)
 */
function parseOperatingHours(value: number | null): number | null {
  if (value === null) return null;
  const hours = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(hours) ? null : Math.round(hours);
}

/**
 * Build AssetFormData from form state
 */
export function buildAssetFormData(form: FormState): AssetFormData {
  const data: AssetFormData = {
    name: form.name,
    status: form.status,
  };

  // Add optional fields only if they have values
  if (form.model) data.model = form.model;
  if (form.manufacturer) data.manufacturer = form.manufacturer;
  if (form.serialNumber) data.serialNumber = form.serialNumber;
  if (form.departmentId !== null) data.departmentId = form.departmentId;
  if (form.areaId !== null) data.areaId = form.areaId;
  if (form.assetType) data.assetType = form.assetType;

  const hours = parseOperatingHours(form.operatingHours);
  if (hours !== null) data.operatingHours = hours;

  // Convert date to ISO format if provided
  if (form.nextMaintenance) {
    data.nextMaintenance = new Date(form.nextMaintenance).toISOString();
  }

  return data;
}

/**
 * Populate form state from existing asset
 */
export function populateFormFromAsset(asset: Asset): FormState {
  return {
    name: asset.name,
    model: asset.model ?? '',
    manufacturer: asset.manufacturer ?? '',
    serialNumber: asset.serialNumber ?? '',
    departmentId: asset.departmentId ?? null,
    areaId: asset.areaId ?? null,
    assetType: asset.assetType ?? '',
    status: asset.status,
    operatingHours: parseOperatingHours(asset.operatingHours ?? null),
    nextMaintenance: formatDateForInput(asset.nextMaintenance),
  };
}
