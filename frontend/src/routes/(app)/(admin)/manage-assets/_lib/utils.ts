// =============================================================================
// MANAGE MACHINES - UTILITY FUNCTIONS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import { MACHINE_TYPE_LABELS, MESSAGES, type AssetMessages } from './constants';

import type {
  Asset,
  AssetFormData,
  AssetStatus,
  AssetStatusFilter,
  AssetTeamInfo,
  PaginationPageItem,
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

/**
 * Format date string to YYYY-MM-DD for HTML date input
 */
function formatDateForInput(dateString?: string): string {
  if (dateString === undefined || dateString === '') return '';
  return new Date(dateString).toISOString().split('T')[0] ?? '';
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

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Page size for client-side pagination of assets.
 * 25 = same value as manage-admins / manage-employees / manage-root (consistency).
 * Backend cap is 100 (PaginationSchema.max in common.schema.ts).
 */
export const ASSETS_PER_PAGE = 25;

/**
 * Compute visible page-button slots with ellipsis gaps.
 *
 * Window of 5 pages around the current page; 1:1 copy of the helper used by
 * manage-admins / manage-employees / manage-root / /logs so the design-system
 * pagination markup stays identical across the app.
 *
 * @see frontend/src/design-system/primitives/navigation/pagination.css
 */
export function getVisiblePages(currentPage: number, totalPages: number): PaginationPageItem[] {
  const pages: PaginationPageItem[] = [];

  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  if (startPage > 1) {
    pages.push({ type: 'page', value: 1 });
    if (startPage > 2) {
      pages.push({ type: 'ellipsis' });
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push({ type: 'page', value: i, active: i === currentPage });
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push({ type: 'ellipsis' });
    }
    pages.push({ type: 'page', value: totalPages });
  }

  return pages;
}
