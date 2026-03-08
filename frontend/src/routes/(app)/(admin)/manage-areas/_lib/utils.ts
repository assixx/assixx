// =============================================================================
// MANAGE AREAS - UTILITY FUNCTIONS
// =============================================================================

import { IS_ACTIVE } from '@assixx/shared/constants';

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  TYPE_LABELS,
  FORM_DEFAULTS,
} from './constants';

import type {
  Area,
  AdminUser,
  Department,
  IsActiveStatus,
  AreaType,
  FormIsActiveStatus,
} from './types';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/** Get status badge class based on is_active value */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/** Get status label for display */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/** Get type label for display */
export function getTypeLabel(type: string): string {
  if (type in TYPE_LABELS) {
    return TYPE_LABELS[type as AreaType];
  }
  return type;
}

// =============================================================================
// AREA LEAD HELPERS
// =============================================================================

/** Get area lead display name for dropdown */
export function getAreaLeadDisplayName(
  areaLeadId: number | null,
  areaLeads: AdminUser[],
): string {
  if (areaLeadId === null) return 'Kein Bereichsleiter';
  const lead = areaLeads.find((u) => u.id === areaLeadId);
  if (!lead) return 'Kein Bereichsleiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// DEPARTMENT HELPERS
// =============================================================================

/** Get department IDs assigned to an area */
export function getDepartmentIdsForArea(
  areaId: number,
  departments: Department[],
): number[] {
  return departments.filter((d) => d.areaId === areaId).map((d) => d.id);
}

/** Get department count display text */
export function getDepartmentCountText(count: number): string {
  if (count === 0) return 'Keine';
  if (count === 1) return '1 Abteilung';
  return `${count} Abteilungen`;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Populate form from area data (for edit mode) */
export function populateFormFromArea(
  area: Area,
  departments: Department[],
): {
  name: string;
  description: string;
  areaLeadId: number | null;
  type: AreaType;
  capacity: number | null;
  address: string;
  departmentIds: number[];
  isActive: FormIsActiveStatus;
} {
  return {
    name: area.name,
    description: area.description ?? '',
    areaLeadId: area.areaLeadId ?? null,
    type: area.type,
    capacity: area.capacity ?? null,
    address: area.address ?? '',
    departmentIds: getDepartmentIdsForArea(area.id, departments),
    isActive: (area.isActive === IS_ACTIVE.DELETED ?
      IS_ACTIVE.INACTIVE
    : area.isActive) as FormIsActiveStatus,
  };
}

/** Get default form values for new area */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
