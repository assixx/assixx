/**
 * Organization Filter Utilities
 *
 * Shared filter functions for Area/Department inheritance logic.
 * Used by: manage-admins, blackboard, calendar modals
 *
 * Principle: When an Area is selected, departments belonging to that area
 * are automatically hidden because access is inherited.
 *
 * Note: Leadership scope filtering is intentionally NOT implemented here —
 * per ADR-036 (Organizational Scope Access Control) the backend services
 * (`/areas`, `/departments`, `/teams`) already return scope-filtered data
 * via `ScopeService`. Duplicating that filter on the client would diverge
 * from the authoritative backend scope (especially for deputy-leads under
 * ADR-039 tenant toggle) and add a second failure mode.
 *
 * @see docs/infrastructure/adr/ADR-036-organizational-scope-access-control.md
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minimal Department interface for filtering
 * Modules can extend this with their own fields
 */
export interface FilterableDepartment {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
}

/**
 * Minimal Team interface for filtering
 */
export interface FilterableTeam {
  id: number;
  name: string;
  departmentId?: number | null;
}

// =============================================================================
// FILTER FUNCTIONS
// =============================================================================

/**
 * Filter available departments based on selected areas.
 * Hides departments that are already covered by selected areas (inheritance).
 *
 * @example
 * // Area "Production" (id: 1) has departments "Assembly" (areaId: 1) and "QA" (areaId: 1)
 * // When area 1 is selected, both departments are hidden
 * filterAvailableDepartments(allDepts, [1], false)
 * // Returns: departments where areaId !== 1
 */
export function filterAvailableDepartments<T extends FilterableDepartment>(
  allDepartments: T[],
  selectedAreaIds: number[],
  isDisabled: boolean,
): T[] {
  if (isDisabled) return [];

  return allDepartments.filter((dept) => {
    // If department's area is in selected areas, hide it (already covered by inheritance)
    return !selectedAreaIds.includes(dept.areaId ?? -1);
  });
}

/**
 * Filter department IDs to remove those covered by selected areas.
 * Call this when areas change to clean up already-selected departments.
 *
 * @example
 * // User had department 5 selected, then selects area 1 which contains dept 5
 * filterDepartmentIdsByAreas([5, 6], allDepts, [1])
 * // Returns: [6] (dept 5 is removed because it belongs to area 1)
 */
export function filterDepartmentIdsByAreas(
  departmentIds: number[],
  allDepartments: FilterableDepartment[],
  selectedAreaIds: number[],
): number[] {
  return departmentIds.filter((deptId) => {
    const dept = allDepartments.find((d) => d.id === deptId);
    // Keep only departments whose area is NOT in selected areas
    return !selectedAreaIds.includes(dept?.areaId ?? -1);
  });
}

/**
 * Filter available teams based on selected departments.
 * Hides teams that are already covered by selected departments (inheritance).
 */
export function filterAvailableTeams<T extends FilterableTeam>(
  allTeams: T[],
  selectedDepartmentIds: number[],
  isDisabled: boolean,
): T[] {
  if (isDisabled) return [];

  return allTeams.filter((team) => {
    // If team's department is in selected departments, hide it
    return !selectedDepartmentIds.includes(team.departmentId ?? -1);
  });
}

/** Filter team IDs to remove those covered by selected departments. */
export function filterTeamIdsByDepartments(
  teamIds: number[],
  allTeams: FilterableTeam[],
  selectedDepartmentIds: number[],
): number[] {
  return teamIds.filter((teamId) => {
    const team = allTeams.find((t) => t.id === teamId);
    return !selectedDepartmentIds.includes(team?.departmentId ?? -1);
  });
}
