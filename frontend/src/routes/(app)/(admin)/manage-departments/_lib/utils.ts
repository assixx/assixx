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
  return areaName ?? 'Kein Bereich';
}

/** Get department lead display name */
export function getLeadDisplay(leadName: string | null | undefined): string {
  return leadName ?? '-';
}

/** Get team count display text */
export function getTeamCountText(count: number): string {
  return count === 1 ? '1 Team' : `${count} Teams`;
}

// =============================================================================
// DROPDOWN HELPERS
// =============================================================================

/** Get selected area name for dropdown trigger */
export function getSelectedAreaName(
  areaId: number | null,
  areas: Area[],
): string {
  if (areaId === null) return 'Kein Bereich';
  const area = areas.find((a) => a.id === areaId);
  return area?.name ?? 'Kein Bereich';
}

/** Get selected lead name for dropdown trigger */
export function getSelectedLeadName(
  leadId: number | null,
  leads: AdminUser[],
): string {
  if (leadId === null) return 'Kein Abteilungsleiter';
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return 'Kein Abteilungsleiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Populate form from department data (for edit mode) */
export function populateFormFromDepartment(department: Department): {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  isActive: FormIsActiveStatus;
} {
  return {
    name: department.name,
    description: department.description ?? '',
    areaId: department.areaId ?? null,
    departmentLeadId: department.departmentLeadId ?? null,
    isActive: (department.isActive === 4 ?
      0
    : department.isActive) as FormIsActiveStatus,
  };
}

/** Get default form values for new department */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
