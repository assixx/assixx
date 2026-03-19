// =============================================================================
// MANAGE DEPARTMENTS - UTILITY FUNCTIONS
// =============================================================================

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  FORM_DEFAULTS,
} from './constants';

import type {
  Department,
  AdminUser,
  Area,
  IsActiveStatus,
  FormIsActiveStatus,
} from './types';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/** Get status badge class based on isActive value */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/** Get status label for display */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/** Get area display name */
export function getAreaDisplay(areaName: string | null | undefined): string {
  return areaName ?? 'Keine Zuordnung';
}

/** Get department lead display name */
export function getLeadDisplay(leadName: string | null | undefined): string {
  return leadName ?? '-';
}

/** Get team count display text */
export function getTeamCountText(count: number, teamLabel: string): string {
  return `${count} ${teamLabel}`;
}

// =============================================================================
// DROPDOWN HELPERS
// =============================================================================

/** Get selected area name for dropdown trigger */
export function getSelectedAreaName(
  areaId: number | null,
  areas: Area[],
): string {
  if (areaId === null) return 'Keine Zuordnung';
  const area = areas.find((a) => a.id === areaId);
  return area?.name ?? 'Keine Zuordnung';
}

/** Get selected lead name for dropdown trigger */
export function getSelectedLeadName(
  leadId: number | null,
  leads: AdminUser[],
): string {
  if (leadId === null) return 'Kein Leiter';
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return 'Kein Leiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Get hall count display text */
export function getHallCountText(count: number, hallLabel: string): string {
  return `${count} ${hallLabel}`;
}

/** Populate form from department data (for edit mode) */
export function populateFormFromDepartment(
  department: Department,
  hallIds: number[] = [],
): {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  hallIds: number[];
  isActive: FormIsActiveStatus;
} {
  return {
    name: department.name,
    description: department.description ?? '',
    areaId: department.areaId ?? null,
    departmentLeadId: department.departmentLeadId ?? null,
    hallIds,
    isActive: (department.isActive === 4 ?
      0
    : department.isActive) as FormIsActiveStatus,
  };
}

/** Get default form values for new department */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
