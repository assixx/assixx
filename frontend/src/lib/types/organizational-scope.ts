/**
 * Organizational Scope Types (Frontend)
 *
 * Mirrors the backend OrganizationalScope interface for type safety.
 * Used by layout data, page access checks, and navigation filtering.
 *
 * @see backend/src/nest/hierarchy-permission/organizational-scope.types.ts
 */

/** Organizational scope for a user — determines manage-page access */
export interface OrganizationalScope {
  type: 'full' | 'limited' | 'none';
  areaIds: number[];
  departmentIds: number[];
  teamIds: number[];
  leadAreaIds: number[];
  leadDepartmentIds: number[];
  leadTeamIds: number[];
  isAreaLead: boolean;
  isDepartmentLead: boolean;
  isTeamLead: boolean;
  isAnyLead: boolean;
  areaNames?: string[];
  departmentNames?: string[];
}

/** Default scope for unauthenticated or error cases */
export const DEFAULT_ORG_SCOPE: OrganizationalScope = {
  type: 'none',
  areaIds: [],
  departmentIds: [],
  teamIds: [],
  leadAreaIds: [],
  leadDepartmentIds: [],
  leadTeamIds: [],
  isAreaLead: false,
  isDepartmentLead: false,
  isTeamLead: false,
  isAnyLead: false,
};
