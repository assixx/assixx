// =============================================================================
// MANAGE DEPARTMENTS - UTILITY FUNCTIONS
// =============================================================================

import { STATUS_BADGE_CLASSES, STATUS_LABELS, FORM_DEFAULTS } from './constants';

import type {
  AdminUser,
  Area,
  Department,
  DepartmentHallEntry,
  FormIsActiveStatus,
  IsActiveStatus,
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
export function getSelectedAreaName(areaId: number | null, areas: Area[]): string {
  if (areaId === null) return 'Keine Zuordnung';
  const area = areas.find((a) => a.id === areaId);
  return area?.name ?? 'Keine Zuordnung';
}

/** Get selected lead name for dropdown trigger */
export function getSelectedLeadName(leadId: number | null, leads: AdminUser[]): string {
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

/**
 * Build tooltip text for hall badge: one hall name per line, annotated with
 * its source ("Bereich" for inherited, "direkt" for cross-area junction).
 */
export function getHallTooltip(halls: DepartmentHallEntry[]): string {
  if (halls.length === 0) return 'Keine zugeordnet';
  return halls.map((h) => `${h.name} (${h.source === 'area' ? 'Bereich' : 'direkt'})`).join('\n');
}

/** Populate form from department data (for edit mode).
 * Only cross-area ("direct") halls are form-editable — area-inherited halls
 * are read-only and displayed separately. See DepartmentModal Section 1/2 UX.
 */
export function populateFormFromDepartment(department: Department): {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  departmentDeputyLeadId: number | null;
  directHallIds: number[];
  isActive: FormIsActiveStatus;
} {
  const directHallIds = (department.halls ?? [])
    .filter((h) => h.source === 'direct')
    .map((h) => h.id);
  return {
    name: department.name,
    description: department.description ?? '',
    areaId: department.areaId ?? null,
    departmentLeadId: department.departmentLeadId ?? null,
    departmentDeputyLeadId: department.departmentDeputyLeadId ?? null,
    directHallIds,
    isActive: department.isActive === 4 ? 0 : department.isActive,
  };
}

/** Get default form values for new department */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
