/**
 * Organizational Scope Types
 *
 * Defines the scope of organizational entities a user can access.
 * Used by HierarchyPermissionService.getScope() and ScopeService.
 *
 * Three scope types:
 * - 'full': Root / has_full_access — sees everything, no filtering needed
 * - 'limited': Scoped Admin or Employee-Lead — sees only assigned entities
 * - 'none': Employee without Lead role / Dummy — no manage-page access
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md
 */

// ============================================================================
// SCOPE TYPES
// ============================================================================

/** Organizational scope for a user — determines what they see on manage-pages */
export interface OrganizationalScope {
  /** 'full' = Root/has_full_access, 'limited' = scoped, 'none' = kein Zugang */
  readonly type: 'full' | 'limited' | 'none';

  /** IDs der zugänglichen Entities (leer bei 'full' und 'none') — UNION aus Permissions + Leads + Kaskade */
  readonly areaIds: number[];
  readonly departmentIds: number[];
  readonly teamIds: number[];

  /** IDs wo User tatsächlich Lead ist (Subset von *Ids oben) — für KVP, Genehmigungen etc. */
  readonly leadAreaIds: number[];
  readonly leadDepartmentIds: number[];
  readonly leadTeamIds: number[];

  /** Convenience-Booleans abgeleitet aus lead*Ids.length > 0 */
  readonly isAreaLead: boolean;
  readonly isDepartmentLead: boolean;
  readonly isTeamLead: boolean;
  readonly isAnyLead: boolean;

  /** Scope-Info für ScopeInfoBanner (nur bei 'limited') */
  readonly areaNames?: string[];
  readonly departmentNames?: string[];
}

// ============================================================================
// SCOPE CONSTANTS
// ============================================================================

/**
 * @deprecated Replaced by per-tenant setting `deputyHasLeadScope` (ADR-039).
 * Read via OrganigramSettingsService.getDeputyHasLeadScope().
 * Kept for backward-compat in tests — will be removed when tests are migrated.
 */
export const DEPUTY_EQUALS_LEAD = true;

/** Scope for Root / has_full_access users — no filtering needed */
export const FULL_SCOPE: OrganizationalScope = {
  type: 'full',
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

/** Scope for users with no manage-page access (Employee ohne Lead, Dummy) */
export const NO_SCOPE: OrganizationalScope = {
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

// ============================================================================
// DB ROW TYPES
// ============================================================================

/** Raw result from the unified CTE scope query */
export interface ScopeQueryRow {
  area_ids: number[];
  department_ids: number[];
  team_ids: number[];
  lead_area_ids: number[];
  lead_department_ids: number[];
  lead_team_ids: number[];
}

// ============================================================================
// HELPER
// ============================================================================

/** Build a 'limited' OrganizationalScope from CTE query result */
export function buildLimitedScope(row: ScopeQueryRow): OrganizationalScope {
  const leadAreaIds = row.lead_area_ids;
  const leadDepartmentIds = row.lead_department_ids;
  const leadTeamIds = row.lead_team_ids;

  return {
    type: 'limited',
    areaIds: row.area_ids,
    departmentIds: row.department_ids,
    teamIds: row.team_ids,
    leadAreaIds,
    leadDepartmentIds,
    leadTeamIds,
    isAreaLead: leadAreaIds.length > 0,
    isDepartmentLead: leadDepartmentIds.length > 0,
    isTeamLead: leadTeamIds.length > 0,
    isAnyLead: leadAreaIds.length > 0 || leadDepartmentIds.length > 0 || leadTeamIds.length > 0,
  };
}
