// =============================================================================
// MANAGE TEAMS - UTILITY FUNCTIONS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';
import { escapeHtml } from '$lib/utils/sanitize-html';

import { STATUS_BADGE_CLASSES, STATUS_LABELS, MESSAGES, FORM_DEFAULTS } from './constants';

import type {
  Team,
  IsActiveStatus,
  FormIsActiveStatus,
  TeamMember,
  Asset,
  Admin,
  Department,
  BadgeInfo,
} from './types';

// =============================================================================
// STATUS BADGE HELPERS
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
// DEPARTMENT BADGE HELPERS (BADGE-INHERITANCE-DISPLAY)
// =============================================================================

/** Badge CSS classes for team table badges */
const BADGE_CLASS_INFO = 'badge--info';
const BADGE_CLASS_SECONDARY = 'badge--secondary';

/**
 * Get department badge info for team table
 * Shows department name with tooltip showing area hierarchy
 * BADGE-INHERITANCE-DISPLAY: Departments are linked to areas
 */
export function getDepartmentBadge(
  team: Team,
  allDepartments: Department[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): BadgeInfo {
  if (team.departmentId === undefined) {
    return {
      class: BADGE_CLASS_SECONDARY,
      text: `Keine ${labels.department}`,
      title: `Keine ${labels.department} zugewiesen`,
    };
  }

  const dept = allDepartments.find((d) => d.id === team.departmentId);
  const deptName = dept?.name ?? team.departmentName ?? 'Unbekannt';
  const areaName = dept?.areaName;
  // SECURITY FIX: Escape user-provided names to prevent XSS
  const safeDeptName = escapeHtml(deptName);

  if (areaName !== undefined && areaName !== '') {
    const safeAreaName = escapeHtml(areaName);
    const tooltip = `${safeDeptName} (gehört zu: ${safeAreaName})`;
    return {
      class: BADGE_CLASS_INFO,
      text: `<i class="fas fa-sitemap mr-1"></i>${safeDeptName}`,
      title: tooltip,
    };
  }

  return {
    class: BADGE_CLASS_INFO,
    text: safeDeptName,
    title: safeDeptName,
  };
}

/** Get members badge info for team table (count with tooltip listing names) */
export function getMembersBadge(team: Team): BadgeInfo {
  const count = Number(team.memberCount ?? 0);
  const names = team.memberNames ?? '';

  if (count === 0) {
    return {
      class: BADGE_CLASS_SECONDARY,
      text: '0',
      title: 'Keine Mitglieder zugewiesen',
    };
  }

  const label = count === 1 ? 'Mitglied' : 'Mitglieder';
  return {
    class: BADGE_CLASS_INFO,
    text: `<i class="fas fa-users mr-1"></i>${count}`,
    title: `${count} ${label}: ${names}`,
  };
}

/** Get assets badge info for team table (count with tooltip listing names) */
export function getAssetsBadge(
  team: Team,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): BadgeInfo {
  const count = Number(team.assetCount ?? 0);
  const names = team.assetNames ?? '';

  if (count === 0) {
    return {
      class: BADGE_CLASS_SECONDARY,
      text: 'Keine',
      title: `Keine ${labels.asset} zugewiesen`,
    };
  }

  // SECURITY FIX: Escape user-provided names to prevent XSS
  const safeNames = escapeHtml(names);
  const label = labels.asset;

  // Show names directly for 1-2 assets, count for 3+
  if (count <= 2) {
    return {
      class: BADGE_CLASS_INFO,
      text: `<i class="fas fa-cog mr-1"></i>${safeNames}`,
      title: `${count} ${label}: ${safeNames}`,
    };
  }

  return {
    class: BADGE_CLASS_INFO,
    text: `<i class="fas fa-cog mr-1"></i>${count} ${label}`,
    title: `${count} ${label}: ${safeNames}`,
  };
}

// =============================================================================
// DATE HELPERS
// =============================================================================

/** Format date for display (de-DE locale) */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return '-';
  }
}

// =============================================================================
// DISPLAY TEXT HELPERS
// =============================================================================

/** Get selected members display text for dropdown */
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

/** Get selected assets display text for dropdown */
export function getAssetsDisplayText(
  assetIds: number[],
  allAssets: Asset[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): string {
  if (assetIds.length === 0) return `Keine ${labels.asset} zugewiesen`;

  const names = assetIds
    .map((id) => {
      const asset = allAssets.find((m) => m.id === id);
      return asset?.name ?? '';
    })
    .filter(Boolean);

  if (names.length <= 2) return names.join(', ');
  return `${names.length} ${labels.asset} ausgewählt`;
}

/** Get department display text */
export function getDepartmentDisplayText(
  departmentId: number | null,
  allDepartments: Department[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): string {
  const fallback = `Keine ${labels.department}`;
  if (departmentId === null) return fallback;
  const dept = allDepartments.find((d) => d.id === departmentId);
  return dept?.name ?? fallback;
}

/** Get leader display text */
export function getLeaderDisplayText(leaderId: number | null, allLeaders: Admin[]): string {
  if (leaderId === null) return MESSAGES.NO_LEADER;
  const leader = allLeaders.find((u) => u.id === leaderId);
  return leader ? `${leader.firstName} ${leader.lastName}` : MESSAGES.NO_LEADER;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Populate form from team data (for edit mode) */
export function populateFormFromTeam(team: Team): {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
  memberIds: number[];
  assetIds: number[];
  isActive: FormIsActiveStatus;
} {
  return {
    name: team.name,
    description: team.description ?? '',
    departmentId: team.departmentId ?? null,
    leaderId: team.leaderId ?? null,
    memberIds: team.members?.map((m) => m.id) ?? [],
    assetIds: team.assets?.map((m) => m.id) ?? [],
    isActive: (team.isActive === 4 ? 0 : team.isActive) as FormIsActiveStatus,
  };
}

/** Get default form values for new team */
export function getDefaultFormValues(): {
  name: string;
  description: string;
  departmentId: null;
  leaderId: null;
  memberIds: number[];
  assetIds: number[];
  isActive: FormIsActiveStatus;
} {
  return { ...FORM_DEFAULTS };
}

// =============================================================================
// TOGGLE HELPERS
// =============================================================================

/** Toggle an ID in an array (add if not present, remove if present) */
export function toggleIdInArray(ids: number[], id: number): number[] {
  if (ids.includes(id)) {
    return ids.filter((i) => i !== id);
  }
  return [...ids, id];
}
