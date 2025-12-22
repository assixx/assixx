// =============================================================================
// MANAGE TEAMS - UTILITY FUNCTIONS
// =============================================================================

import type {
  Team,
  IsActiveStatus,
  FormIsActiveStatus,
  TeamMember,
  Machine,
  Admin,
  Department,
} from './types';
import { STATUS_BADGE_CLASSES, STATUS_LABELS, MESSAGES, FORM_DEFAULTS } from './constants';

// =============================================================================
// STATUS BADGE HELPERS
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
// DATE HELPERS
// =============================================================================

/**
 * Format date for display
 * @param dateStr - ISO date string
 * @returns Formatted date string (de-DE locale)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return '-';
  }
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
  if (!query || !query.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// DISPLAY TEXT HELPERS
// =============================================================================

/**
 * Get selected members display text for dropdown
 * @param memberIds - Array of selected member IDs
 * @param allEmployees - All available employees
 * @returns Display text for the dropdown trigger
 */
export function getMembersDisplayText(memberIds: number[], allEmployees: TeamMember[]): string {
  if (memberIds.length === 0) return MESSAGES.NO_MEMBERS;

  const names = memberIds
    .map((id) => {
      const emp = allEmployees.find((e) => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : '';
    })
    .filter(Boolean);

  if (names.length <= 2) return names.join(', ');
  return `${names.length} Mitglieder ausgewählt`;
}

/**
 * Get selected machines display text for dropdown
 * @param machineIds - Array of selected machine IDs
 * @param allMachines - All available machines
 * @returns Display text for the dropdown trigger
 */
export function getMachinesDisplayText(machineIds: number[], allMachines: Machine[]): string {
  if (machineIds.length === 0) return MESSAGES.NO_MACHINES;

  const names = machineIds
    .map((id) => {
      const machine = allMachines.find((m) => m.id === id);
      return machine?.name ?? '';
    })
    .filter(Boolean);

  if (names.length <= 2) return names.join(', ');
  return `${names.length} Maschinen ausgewählt`;
}

/**
 * Get department display text
 * @param departmentId - Selected department ID or null
 * @param allDepartments - All available departments
 * @returns Department name or default text
 */
export function getDepartmentDisplayText(
  departmentId: number | null,
  allDepartments: Department[],
): string {
  if (!departmentId) return MESSAGES.NO_DEPARTMENT;
  const dept = allDepartments.find((d) => d.id === departmentId);
  return dept?.name ?? MESSAGES.NO_DEPARTMENT;
}

/**
 * Get leader display text
 * @param leaderId - Selected leader ID or null
 * @param allAdmins - All available admins
 * @returns Leader name or default text
 */
export function getLeaderDisplayText(leaderId: number | null, allAdmins: Admin[]): string {
  if (!leaderId) return MESSAGES.NO_LEADER;
  const admin = allAdmins.find((a) => a.id === leaderId);
  return admin ? `${admin.firstName} ${admin.lastName}` : MESSAGES.NO_LEADER;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/**
 * Populate form from team data (for edit mode)
 * @param team - Team to edit
 * @returns Form data object
 */
export function populateFormFromTeam(team: Team): {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
  memberIds: number[];
  machineIds: number[];
  isActive: FormIsActiveStatus;
} {
  return {
    name: team.name,
    description: team.description ?? '',
    departmentId: team.departmentId ?? null,
    leaderId: team.leaderId ?? null,
    memberIds: team.members?.map((m) => m.id) ?? [],
    machineIds: team.machines?.map((m) => m.id) ?? [],
    isActive: (team.isActive === 4 ? 0 : team.isActive) as FormIsActiveStatus,
  };
}

/**
 * Get default form values for new team
 * @returns Default form data object
 */
export function getDefaultFormValues(): {
  name: string;
  description: string;
  departmentId: null;
  leaderId: null;
  memberIds: number[];
  machineIds: number[];
  isActive: FormIsActiveStatus;
} {
  return { ...FORM_DEFAULTS };
}

// =============================================================================
// TOGGLE HELPERS
// =============================================================================

/**
 * Toggle an ID in an array (add if not present, remove if present)
 * @param ids - Current array of IDs
 * @param id - ID to toggle
 * @returns New array with ID toggled
 */
export function toggleIdInArray(ids: number[], id: number): number[] {
  if (ids.includes(id)) {
    return ids.filter((i) => i !== id);
  }
  return [...ids, id];
}
