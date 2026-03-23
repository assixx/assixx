/**
 * KVP Helpers
 *
 * Pure functions for the KVP module: transforms, query builders, visibility checks.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';

import { dbToApi } from '../../utils/field-mapper.js';
import type { OrganizationalScope } from '../hierarchy-permission/organizational-scope.types.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import type {
  DbSuggestion,
  ExtendedUserOrgInfo,
  KVPSuggestionResponse,
  OrgPlaceholders,
  SuggestionFilters,
} from './kvp.types.js';

// ============================================================================
// ID HELPERS
// ============================================================================

/** Check if a value is a valid UUID */
export function isUuid(value: string | number): boolean {
  if (typeof value === 'number') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

/** Transform database suggestion to API format */
export function transformSuggestion(suggestion: DbSuggestion): KVPSuggestionResponse {
  const base = dbToApi(
    suggestion as unknown as Record<string, unknown>,
  ) as unknown as KVPSuggestionResponse;

  attachCategoryIfPresent(base, suggestion);
  attachSubmitterIfPresent(base, suggestion);
  attachConfirmationStatus(base, suggestion);

  return base;
}

/** Attach category object to response */
function attachCategoryIfPresent(base: KVPSuggestionResponse, suggestion: DbSuggestion): void {
  if (suggestion.category_name === undefined) return;
  const category: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
    isDeleted?: boolean;
  } = {
    id: suggestion.category_id,
    name: suggestion.category_name,
  };
  if (suggestion.category_color !== undefined) category.color = suggestion.category_color;
  if (suggestion.category_icon !== undefined) category.icon = suggestion.category_icon;
  if (suggestion.category_is_deleted === true) category.isDeleted = true;
  base.category = category;
}

/** Attach submitter object to response */
function attachSubmitterIfPresent(base: KVPSuggestionResponse, suggestion: DbSuggestion): void {
  if (suggestion.submitted_by_name === undefined) return;
  base.submitter = {
    firstName: suggestion.submitted_by_name,
    lastName: suggestion.submitted_by_lastname ?? '',
  };
}

/** Attach read confirmation status to response */
function attachConfirmationStatus(base: KVPSuggestionResponse, suggestion: DbSuggestion): void {
  // COALESCE(is_confirmed, false) ensures boolean, never null
  if (suggestion.is_confirmed !== undefined) {
    base.isConfirmed = suggestion.is_confirmed;
  }
  // Timestamps can be null from LEFT JOIN
  if (suggestion.confirmed_at !== undefined && suggestion.confirmed_at !== null) {
    base.confirmedAt = new Date(suggestion.confirmed_at).toISOString();
  }
  // firstSeenAt: only set if user has seen it (undefined = "Neu" badge)
  if (suggestion.first_seen_at !== undefined && suggestion.first_seen_at !== null) {
    base.firstSeenAt = new Date(suggestion.first_seen_at).toISOString();
  }
}

// ============================================================================
// VISIBILITY HELPERS
// ============================================================================

/**
 * Build visibility clause for KVP queries
 *
 * Two-phase visibility model:
 * - Unshared (is_shared=false): Strict team scope — only creator, direct team members
 *   (user_teams), team_lead/deputy_lead. Admins without has_full_access cannot see.
 * - Shared (is_shared=true): Full org-scope visibility via admin permissions + lead
 *   positions + hierarchy cascade (dept/area/company).
 * - Always visible: creator's own, implemented, company-level
 */
/** L0: Not shared — creator + team lead/deputy of assigned team */
function buildUnsharedClause(h: OrgPlaceholders): string {
  return `(s.is_shared = false AND (
    s.org_level = 'team' AND s.org_id IN (
      SELECT t.id FROM teams t
      WHERE (t.team_lead_id = ${h.userId} OR t.team_deputy_lead_id = ${h.userId}) AND t.tenant_id = s.tenant_id
    )
  ))`;
}

/**
 * L1-L4: Shared — cascading visibility via user_teams membership.
 * Team-level uses user_teams JOIN (NOT cascaded scope) — see KVP-SHARING-VISIBILITY.md
 */
function buildSharedClause(h: OrgPlaceholders): string {
  return `(s.is_shared = true AND (
    (s.org_level = 'team' AND (
      s.org_id = ANY(${h.teamLeadOf})
      OR EXISTS (SELECT 1 FROM user_teams ut WHERE ut.user_id = ${h.userId} AND ut.team_id = s.org_id)
    ))
    OR (s.org_level = 'department' AND (
      s.org_id = ANY(${h.deptIds}) OR s.org_id = ANY(${h.teamsDeptIds}) OR s.org_id = ANY(${h.deptLeadOf})
      OR EXISTS (SELECT 1 FROM user_teams ut JOIN teams t ON ut.team_id = t.id WHERE ut.user_id = ${h.userId} AND t.department_id = s.org_id)
    ))
    OR (s.org_level = 'area' AND (
      s.org_id = ANY(${h.areaIds}) OR s.org_id = ANY(${h.deptsAreaIds}) OR s.org_id = ANY(${h.areaLeadOf})
      OR EXISTS (SELECT 1 FROM user_teams ut JOIN teams t ON ut.team_id = t.id JOIN departments d ON t.department_id = d.id WHERE ut.user_id = ${h.userId} AND d.area_id = s.org_id)
    ))
  ))`;
}

/**
 * Approval master visibility: user sees KVPs if they are configured as
 * approval master (user or position type) and the KVP falls within their scope.
 * Uses approval_configs.scope_area_ids/scope_department_ids/scope_team_ids.
 * NULL scope = whole tenant. dep_kvp JOIN derives area_id from department_id.
 */
function buildApprovalMasterClause(h: OrgPlaceholders): string {
  return `EXISTS (
    SELECT 1 FROM approval_configs ac
    LEFT JOIN departments dep_kvp ON dep_kvp.id = s.department_id
    WHERE ac.addon_code = 'kvp'
      AND ac.tenant_id = s.tenant_id
      AND ac.is_active = 1
      AND (
        ac.approver_user_id = ${h.userId}
        OR ac.approver_position_id IN (
          SELECT up.position_id FROM user_positions up
          WHERE up.user_id = ${h.userId} AND up.tenant_id = s.tenant_id
        )
      )
      AND (
        (ac.scope_area_ids IS NULL AND ac.scope_department_ids IS NULL AND ac.scope_team_ids IS NULL)
        OR dep_kvp.area_id = ANY(ac.scope_area_ids)
        OR s.department_id = ANY(ac.scope_department_ids)
        OR s.team_id = ANY(ac.scope_team_ids)
      )
  )`;
}

/** KVP Visibility — see KVP-SHARING-VISIBILITY.md for full rules */
export function buildVisibilityClause(
  orgInfo: ExtendedUserOrgInfo,
  userId: number,
  startIdx: number,
): { clause: string; params: unknown[] } {
  if (orgInfo.hasFullAccess) {
    return { clause: '', params: [] };
  }

  const { params, placeholders: h } = buildOrgParams(orgInfo, userId, startIdx);

  const clause = ` AND (
    s.submitted_by = ${h.userId}
    OR s.status = 'implemented'
    OR s.org_level = 'company'
    OR ${buildUnsharedClause(h)}
    OR ${buildSharedClause(h)}
    OR ${buildApprovalMasterClause(h)}
  )`;

  return { clause, params };
}

/** Build parameterized arrays for org-based visibility checks */
export function buildOrgParams(
  orgInfo: ExtendedUserOrgInfo,
  userId: number,
  startIdx: number,
): { params: unknown[]; placeholders: OrgPlaceholders } {
  const toArray = (arr: number[]): number[] => (arr.length > 0 ? arr : [0]);
  let idx = startIdx;

  const params: unknown[] = [
    toArray(orgInfo.teamLeadOf),
    toArray(orgInfo.departmentIds),
    toArray(orgInfo.teamsDepartmentIds),
    toArray(orgInfo.departmentLeadOf),
    toArray(orgInfo.areaIds),
    toArray(orgInfo.departmentsAreaIds),
    toArray(orgInfo.areaLeadOf),
    userId,
  ];

  const placeholders: OrgPlaceholders = {
    teamLeadOf: `$${idx++}`,
    deptIds: `$${idx++}`,
    teamsDeptIds: `$${idx++}`,
    deptLeadOf: `$${idx++}`,
    areaIds: `$${idx++}`,
    deptsAreaIds: `$${idx++}`,
    areaLeadOf: `$${idx++}`,
    // eslint-disable-next-line no-useless-assignment -- idx++ kept for consistency so adding a new placeholder won't reuse the same index
    userId: `$${idx++}`,
  };

  return { params, placeholders };
}

/** Check if user has org-level access to a suggestion (with proper inheritance) */
export function hasExtendedOrgAccess(
  orgLevel: string,
  orgId: number,
  orgInfo: ExtendedUserOrgInfo,
): boolean {
  // Full access bypasses all checks
  if (orgInfo.hasFullAccess) return true;

  // Company level = everyone in tenant
  if (orgLevel === 'company') return true;

  // Team level: member or lead
  if (orgLevel === 'team') {
    return orgInfo.teamIds.includes(orgId) || orgInfo.teamLeadOf.includes(orgId);
  }

  // Department level: member, team in dept, or lead
  if (orgLevel === 'department') {
    return (
      orgInfo.departmentIds.includes(orgId) ||
      orgInfo.teamsDepartmentIds.includes(orgId) ||
      orgInfo.departmentLeadOf.includes(orgId)
    );
  }

  // Area level: dept in area, or lead
  if (orgLevel === 'area') {
    return (
      orgInfo.areaIds.includes(orgId) ||
      orgInfo.departmentsAreaIds.includes(orgId) ||
      orgInfo.areaLeadOf.includes(orgId)
    );
  }

  return false;
}

// ============================================================================
// QUERY BUILDING HELPERS
// ============================================================================

/**
 * Build base query for suggestion listing with confirmation status
 * @param userIdPlaceholder - PostgreSQL placeholder for userId (e.g., '$2')
 */
export function buildListBaseQuery(userIdPlaceholder: string): string {
  return `
    SELECT
      s.*,
      COALESCE(kcc_new.custom_name, kcc_override.custom_name, c.name) as category_name,
      COALESCE(kcc_new.color, c.color) as category_color,
      COALESCE(kcc_new.icon, c.icon) as category_icon,
      CASE WHEN kcc_new.is_active = ${IS_ACTIVE.DELETED} THEN true ELSE false END as category_is_deleted,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      a.name as area_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname,
      (SELECT COUNT(*)::integer FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count,
      (SELECT COUNT(*)::integer FROM kvp_comments WHERE suggestion_id = s.id) as comment_count,
      COALESCE(kc.is_confirmed, false) as is_confirmed,
      kc.confirmed_at,
      kc.first_seen_at
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN kvp_categories_custom kcc_override ON c.id = kcc_override.category_id AND kcc_override.tenant_id = s.tenant_id
    LEFT JOIN kvp_categories_custom kcc_new ON s.custom_category_id = kcc_new.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN areas a ON s.org_level = 'area' AND s.org_id = a.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = ${userIdPlaceholder} AND kc.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1
  `;
}

/**
 * Build base query for single suggestion with confirmation status
 * @param userIdPlaceholder - PostgreSQL placeholder for userId (e.g., '$3')
 */
export function buildDetailBaseQuery(userIdPlaceholder: string): string {
  return `
    SELECT
      s.*,
      COALESCE(kcc_new.custom_name, kcc_override.custom_name, c.name) as category_name,
      COALESCE(kcc_new.color, c.color) as category_color,
      COALESCE(kcc_new.icon, c.icon) as category_icon,
      CASE WHEN kcc_new.is_active = ${IS_ACTIVE.DELETED} THEN true ELSE false END as category_is_deleted,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      a.name as area_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname,
      COALESCE(kc.is_confirmed, false) as is_confirmed,
      kc.confirmed_at,
      kc.first_seen_at
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN kvp_categories_custom kcc_override ON c.id = kcc_override.category_id AND kcc_override.tenant_id = s.tenant_id
    LEFT JOIN kvp_categories_custom kcc_new ON s.custom_category_id = kcc_new.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN areas a ON s.org_level = 'area' AND s.org_id = a.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = ${userIdPlaceholder} AND kc.tenant_id = s.tenant_id
  `;
}

/** Build status filter clause (archived excluded by default) */
export function buildStatusFilter(
  status: string | undefined,
  idx: number,
): { clause: string; param: string | null; nextIdx: number } {
  if (status === 'archived') {
    return {
      clause: ` AND s.status = 'archived'`,
      param: null,
      nextIdx: idx,
    };
  }
  if (status !== undefined && status !== '') {
    return {
      clause: ` AND s.status = $${idx}`,
      param: status,
      nextIdx: idx + 1,
    };
  }
  return { clause: ` AND s.status != 'archived'`, param: null, nextIdx: idx };
}

/** Type guard: check if optional string has a non-empty value */
function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/** Build filter conditions for suggestion queries */
export function buildFilterConditions(
  filters: SuggestionFilters,
  startIdx: number,
): { clause: string; params: unknown[] } {
  let clause = '';
  const params: unknown[] = [];
  let idx = startIdx;

  // Status filter: if 'archived' show only archived, otherwise EXCLUDE archived
  const statusResult = buildStatusFilter(filters.status, idx);
  clause += statusResult.clause;
  if (statusResult.param !== null) params.push(statusResult.param);
  idx = statusResult.nextIdx;

  if (filters.categoryId !== undefined) {
    clause += ` AND s.category_id = $${idx++}`;
    params.push(filters.categoryId);
  }
  if (filters.customCategoryId !== undefined) {
    clause += ` AND s.custom_category_id = $${idx++}`;
    params.push(filters.customCategoryId);
  }
  if (isNonEmptyString(filters.priority)) {
    clause += ` AND s.priority = $${idx++}`;
    params.push(filters.priority);
  }
  if (isNonEmptyString(filters.orgLevel)) {
    clause += ` AND s.org_level = $${idx++}`;
    params.push(filters.orgLevel);
  }
  if (filters.teamId !== undefined) {
    clause += ` AND s.team_id = $${idx++}`;
    params.push(filters.teamId);
  }
  if (isNonEmptyString(filters.search)) {
    clause += ` AND (s.title ILIKE $${idx} OR s.description ILIKE $${idx})`;
    // eslint-disable-next-line no-useless-assignment -- idx++ kept for consistency so adding a new filter won't reuse the same index
    idx++;
    params.push(`%${filters.search}%`);
  }

  return { clause, params };
}

/** Build count query by stripping confirmation JOIN and adjusting placeholders */
export function buildCountQuery(
  query: string,
  params: unknown[],
): { countQuery: string; countParams: unknown[] } {
  // Remove userId ($2) from params since confirmation JOIN is stripped
  const countParams = [params[0], ...params.slice(2)];
  const countQuery = query
    .replace(
      /SELECT\s+s\.\*[\s\S]*?FROM kvp_suggestions s/i,
      'SELECT COUNT(*) as total FROM kvp_suggestions s',
    )
    .replace(/LEFT JOIN kvp_confirmations kc[^\n]*/i, '')
    .replace(/,\s*CASE WHEN kc\.id[^\n]*/i, '')
    .replace(/\$(\d+)/g, (_match: string, num: string) => {
      const n = Number.parseInt(num, 10);
      if (n <= 1) return `$${n}`; // $1 (tenantId) stays
      return `$${n - 1}`; // $2→$1, $3→$2, etc. (shift down by 1)
    });

  return { countQuery, countParams };
}

/** Build suggestion update clause from DTO */
export function buildSuggestionUpdateClause(
  dto: UpdateSuggestionDto,
  assignedTo?: number,
): { updates: string[]; params: unknown[] } {
  const updates: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  const addField = (value: unknown, column: string): void => {
    if (value !== undefined) {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    }
  };

  addField(dto.title, 'title');
  addField(dto.description, 'description');
  addField(dto.categoryId, 'category_id');
  addField(dto.customCategoryId, 'custom_category_id');
  addField(dto.priority, 'priority');
  addField(dto.expectedBenefit, 'expected_benefit');
  addField(dto.estimatedCost, 'estimated_cost');
  addField(dto.actualSavings, 'actual_savings');

  // Handle status-specific fields
  if (dto.status !== undefined) {
    addField(dto.status, 'status');
    addField(assignedTo, 'assigned_to');

    if (dto.status === 'rejected') {
      // When rejecting: set rejection reason, clear implementation date
      addField(dto.rejectionReason, 'rejection_reason');
      params.push(null);
      updates.push(`implementation_date = $${params.length}`);
    } else if (dto.status === 'implemented') {
      // When implementing: set implementation date to today, clear rejection reason
      updates.push('implementation_date = CURRENT_DATE');
      params.push(null);
      updates.push(`rejection_reason = $${params.length}`);
    } else {
      // Other status changes: clear both rejection reason and implementation date
      params.push(null);
      updates.push(`rejection_reason = $${params.length}`);
      params.push(null);
      updates.push(`implementation_date = $${params.length}`);
    }
  } else {
    // No status change - only update rejection reason if explicitly provided
    addField(dto.rejectionReason, 'rejection_reason');
  }

  return { updates, params };
}

/** Map team ID to notification recipient */
export function mapTeamToRecipient(teamId: number): {
  type: 'team';
  id: number;
} {
  return { type: 'team', id: teamId };
}

/** Map OrganizationalScope → ExtendedUserOrgInfo for helper compatibility */
export function mapScopeToOrgInfo(scope: OrganizationalScope): ExtendedUserOrgInfo {
  return {
    teamIds: scope.teamIds,
    departmentIds: scope.departmentIds,
    areaIds: scope.areaIds,
    teamLeadOf: scope.leadTeamIds,
    departmentLeadOf: scope.leadDepartmentIds,
    areaLeadOf: scope.leadAreaIds,
    teamsDepartmentIds: [],
    departmentsAreaIds: [],
    hasFullAccess: scope.type === 'full',
  };
}

// =============================================================================
// APPROVAL STATUS TRANSITION ENFORCEMENT
// =============================================================================

/**
 * Validates whether a manual status transition is allowed when an approval
 * config exists for addon 'kvp'. Prevents bypassing the approval workflow
 * via direct PUT /kvp/:id with { status: 'approved' }.
 *
 * When no approval config exists, all transitions are allowed (old behavior).
 */
export function validateApprovalStatusTransition(
  currentStatus: string,
  newStatus: string,
  hasApprovalConfig: boolean,
): { allowed: boolean; reason?: string } {
  if (!hasApprovalConfig) {
    return { allowed: true };
  }

  const lockedStatuses = ['in_review', 'rejected', 'implemented', 'archived'];
  if (lockedStatuses.includes(currentStatus)) {
    return {
      allowed: false,
      reason: `Status '${currentStatus}' ist gesperrt — keine manuellen Änderungen möglich`,
    };
  }

  if (newStatus === 'approved') {
    return {
      allowed: false,
      reason: 'Status "genehmigt" kann nur durch den Freigabe-Master gesetzt werden',
    };
  }

  if (newStatus === 'in_review') {
    return {
      allowed: false,
      reason: 'Status "in Prüfung" wird automatisch beim Anfordern einer Freigabe gesetzt',
    };
  }

  // new/restored → rejected: allowed (direct reject by Team Lead)
  if ((currentStatus === 'new' || currentStatus === 'restored') && newStatus === 'rejected') {
    return { allowed: true };
  }

  // approved → implemented: allowed (Team Lead confirms implementation)
  if (currentStatus === 'approved' && newStatus === 'implemented') {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Statusübergang von '${currentStatus}' zu '${newStatus}' ist nicht erlaubt`,
  };
}
