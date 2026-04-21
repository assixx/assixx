// =============================================================================
// MANAGE AREAS - UTILITY FUNCTIONS
// =============================================================================

import { IS_ACTIVE } from '@assixx/shared/constants';

import { STATUS_BADGE_CLASSES, STATUS_LABELS, TYPE_LABELS, FORM_DEFAULTS } from './constants';

import type {
  Area,
  AdminUser,
  Department,
  Hall,
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
export function getAreaLeadDisplayName(areaLeadId: number | null, areaLeads: AdminUser[]): string {
  if (areaLeadId === null) return 'Kein Leiter';
  const lead = areaLeads.find((u) => u.id === areaLeadId);
  if (!lead) return 'Kein Leiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// DEPARTMENT HELPERS
// =============================================================================

/** Get department IDs assigned to an area */
export function getDepartmentIdsForArea(areaId: number, departments: Department[]): number[] {
  return departments.filter((d) => d.areaId === areaId).map((d) => d.id);
}

/** Get department count display text */
export function getDepartmentCountText(count: number, departmentLabel: string): string {
  if (count === 0) return 'Keine';
  return `${count} ${departmentLabel}`;
}

// =============================================================================
// HALL HELPERS
// =============================================================================

/** Get hall IDs assigned to an area */
export function getHallIdsForArea(areaId: number, halls: Hall[]): number[] {
  return halls.filter((h) => h.areaId === areaId).map((h) => h.id);
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Populate form from area data (for edit mode) */
export function populateFormFromArea(
  area: Area,
  departments: Department[],
  halls: Hall[] = [],
): {
  name: string;
  description: string;
  areaLeadId: number | null;
  type: AreaType;
  capacity: number | null;
  address: string;
  departmentIds: number[];
  hallIds: number[];
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
    hallIds: getHallIdsForArea(area.id, halls),
    isActive: area.isActive === IS_ACTIVE.DELETED ? IS_ACTIVE.INACTIVE : area.isActive,
  };
}

/** Get default form values for new area */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
