// =============================================================================
// MANAGE DEPARTMENTS - UTILITY FUNCTIONS
// =============================================================================

import type { Department, AdminUser, Area, IsActiveStatus, FormIsActiveStatus } from './types';
import { STATUS_BADGE_CLASSES, STATUS_LABELS, FORM_DEFAULTS } from './constants';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get status badge class based on isActive value
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns CSS class for badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive] ?? 'badge--secondary';
}

/**
 * Get status label for display
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns Human-readable status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive] ?? 'Unbekannt';
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Get area display name
 * @param areaName - Area name from department
 * @returns Display string
 */
export function getAreaDisplay(areaName: string | null | undefined): string {
  return areaName ?? 'Kein Bereich';
}

/**
 * Get department lead display name
 * @param leadName - Lead name from department
 * @returns Display string
 */
export function getLeadDisplay(leadName: string | null | undefined): string {
  return leadName ?? '-';
}

/**
 * Get team count display text
 * @param count - Number of teams
 * @returns Display text
 */
export function getTeamCountText(count: number): string {
  return count === 1 ? '1 Team' : `${count} Teams`;
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text
 * Wraps matches in <strong> tags for display
 * @param text - Text to search in
 * @param query - Search query
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query?.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// DROPDOWN HELPERS
// =============================================================================

/**
 * Get selected area name for dropdown trigger
 * @param areaId - Selected area ID
 * @param areas - Available areas
 * @returns Display name string
 */
export function getSelectedAreaName(areaId: number | null, areas: Area[]): string {
  if (areaId === null) return 'Kein Bereich';
  const area = areas.find((a) => a.id === areaId);
  return area?.name ?? 'Kein Bereich';
}

/**
 * Get selected lead name for dropdown trigger
 * @param leadId - Selected lead ID
 * @param leads - Available leads
 * @returns Display name string
 */
export function getSelectedLeadName(leadId: number | null, leads: AdminUser[]): string {
  if (leadId === null) return 'Kein Abteilungsleiter';
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return 'Kein Abteilungsleiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/**
 * Populate form from department data (for edit mode)
 * @param department - Department to edit
 * @returns Form data object
 */
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
    isActive: (department.isActive === 4 ? 0 : department.isActive) as FormIsActiveStatus,
  };
}

/**
 * Get default form values for new department
 * @returns Default form data object
 */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
