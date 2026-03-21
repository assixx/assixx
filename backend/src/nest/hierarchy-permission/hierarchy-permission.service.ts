/**
 * Hierarchy Permission Service
 * Central logic for permission checks with Area → Department inheritance
 *
 * Permission Check Flow:
 * 1. Root user → TRUE (always)
 * 2. has_full_access flag → TRUE (full tenant access)
 * 3. Direct permission on resource
 * 4. Inherited permission (Area → Department)
 * 5. Team = membership only (user_teams)
 *
 * Migrated from services/hierarchyPermission.service.ts to NestJS \@Injectable.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { OrganigramSettingsService } from '../organigram/organigram-settings.service.js';
import { FULL_SCOPE, NO_SCOPE, buildLimitedScope } from './organizational-scope.types.js';
import type { OrganizationalScope, ScopeQueryRow } from './organizational-scope.types.js';

// ============================================================================
// TYPES
// ============================================================================

/** Permission levels for CRUD operations */
export type PermissionLevel = 'read' | 'write' | 'delete';

/** Resource types that can have permissions */
export type ResourceType = 'area' | 'department' | 'team';

/** Result from permission check queries */
interface PermissionRow extends QueryResultRow {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

/** User info for permission checks */
interface UserInfoRow extends QueryResultRow {
  id: number;
  role: string;
  has_full_access: boolean;
}

/** Department info for inheritance */
interface DepartmentInfoRow extends QueryResultRow {
  id: number;
  area_id: number | null;
}

/** Team info for inheritance */
interface TeamInfoRow extends QueryResultRow {
  id: number;
  department_id: number | null;
}

/** Team membership check result */
interface TeamMemberRow extends QueryResultRow {
  user_id: number;
}

/** Generic ID row result */
interface IdRow extends QueryResultRow {
  id: number;
}

/** Area permission row result */
interface AreaIdRow extends QueryResultRow {
  area_id: number;
}

/** Department permission row result */
interface DepartmentIdRow extends QueryResultRow {
  department_id: number;
}

/** Team membership row result */
interface TeamIdRow extends QueryResultRow {
  team_id: number;
}

// ============================================================================
// SQL CONSTANTS
// ============================================================================

/**
 * Build the Unified Scope CTE — resolves ALL access paths in a single query.
 * When deputyScope=true, deputies get equal scope rights as their leads (ADR-039).
 * When deputyScope=false, only direct lead positions grant scope.
 */
function buildScopeCte(deputyScope: boolean): string {
  const areaDeputy = deputyScope ? 'OR area_deputy_lead_id = $1' : '';
  const deptDeputy = deputyScope ? 'OR department_deputy_lead_id = $1' : '';
  const teamDeputy = deputyScope ? 'OR team_deputy_lead_id = $1' : '';
  return `
WITH
perm_areas AS (
  SELECT aap.area_id AS id FROM admin_area_permissions aap
  INNER JOIN areas a ON a.id = aap.area_id AND a.is_active = ${IS_ACTIVE.ACTIVE}
  WHERE aap.admin_user_id = $1 AND aap.tenant_id = $2
),
lead_areas AS (
  SELECT id FROM areas
  WHERE (area_lead_id = $1 ${areaDeputy})
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
),
all_areas AS (
  SELECT id FROM perm_areas UNION SELECT id FROM lead_areas
),
perm_depts AS (
  SELECT adp.department_id AS id FROM admin_department_permissions adp
  INNER JOIN departments d ON d.id = adp.department_id AND d.is_active = ${IS_ACTIVE.ACTIVE}
  WHERE adp.admin_user_id = $1 AND adp.tenant_id = $2
),
lead_depts AS (
  SELECT id FROM departments
  WHERE (department_lead_id = $1 ${deptDeputy})
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
),
inherited_depts AS (
  SELECT d.id FROM departments d
  INNER JOIN all_areas aa ON d.area_id = aa.id
  WHERE d.is_active = ${IS_ACTIVE.ACTIVE} AND d.tenant_id = $2
),
all_depts AS (
  SELECT id FROM perm_depts
  UNION SELECT id FROM lead_depts
  UNION SELECT id FROM inherited_depts
),
lead_teams AS (
  SELECT id FROM teams
  WHERE (team_lead_id = $1 ${teamDeputy})
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
),
inherited_teams AS (
  SELECT t.id FROM teams t
  INNER JOIN all_depts ad ON t.department_id = ad.id
  WHERE t.is_active = ${IS_ACTIVE.ACTIVE} AND t.tenant_id = $2
),
all_teams AS (
  SELECT id FROM lead_teams UNION SELECT id FROM inherited_teams
)
SELECT (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_areas) AS area_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_depts) AS department_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_teams) AS team_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM lead_areas) AS lead_area_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM lead_depts) AS lead_department_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM lead_teams) AS lead_team_ids`;
}

/** Build visible users query — conditionally includes deputy lead checks */
function buildVisibleUsersQuery(deputyScope: boolean): string {
  const teamDeputy = deputyScope ? 'OR t.team_deputy_lead_id = u.id' : '';
  return `
SELECT DISTINCT u.id FROM users u
WHERE u.tenant_id = $1 AND u.is_active != ${IS_ACTIVE.DELETED} AND (
  EXISTS (SELECT 1 FROM user_departments ud
          WHERE ud.user_id = u.id AND ud.department_id = ANY($2::int[]))
  OR EXISTS (SELECT 1 FROM user_teams ut
             WHERE ut.user_id = u.id AND ut.team_id = ANY($3::int[]))
  OR EXISTS (SELECT 1 FROM teams t
             WHERE (t.team_lead_id = u.id ${teamDeputy})
               AND t.id = ANY($3::int[]) AND t.is_active = ${IS_ACTIVE.ACTIVE})
)
`;
}

// ============================================================================
// SERVICE
// ============================================================================

/** Handles all permission checks with hierarchical inheritance */
@Injectable()
export class HierarchyPermissionService {
  private readonly logger = new Logger(HierarchyPermissionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly orgSettings: OrganigramSettingsService,
  ) {}

  // ==========================================================================
  // MAIN ACCESS CHECK
  // ==========================================================================

  /**
   * Check if user has access to a resource.
   * This is the MAIN entry point for permission checks.
   */
  async hasAccess(
    userId: number,
    tenantId: number,
    resourceType: ResourceType,
    resourceId: number,
    permission: PermissionLevel = 'read',
  ): Promise<boolean> {
    try {
      // Step 1: Get user info
      const user = await this.getUserInfo(userId, tenantId);
      if (user === null) {
        this.logger.warn(`User not found: ${userId}`);
        return false;
      }

      // Step 2: Root = always access
      if (user.role === 'root') {
        return true;
      }

      // Step 3: has_full_access flag = full tenant access
      if (user.has_full_access) {
        return true;
      }

      // Step 4: Check based on resource type
      switch (resourceType) {
        case 'area':
          return await this.checkAreaAccess(userId, resourceId, permission, tenantId);

        case 'department':
          return await this.checkDepartmentAccess(userId, resourceId, permission, tenantId);

        case 'team':
          return await this.checkTeamAccess(userId, resourceId, tenantId);

        default:
          this.logger.warn(`Unknown resource type: ${String(resourceType)}`);
          return false;
      }
    } catch (error: unknown) {
      this.logger.error(error, 'Error in hasAccess');
      return false;
    }
  }

  // ==========================================================================
  // ORGANIZATIONAL SCOPE
  // ==========================================================================

  /**
   * Resolve the organizational scope for a user.
   * Single CTE merges Admin-Permissions + Lead-Positions + Kaskade.
   *
   * - Root / has_full_access → type: 'full'
   * - Admin → type: 'limited' (even if empty scope)
   * - Employee with Lead → type: 'limited'
   * - Employee without Lead / Dummy → type: 'none'
   */
  async getScope(userId: number, tenantId: number): Promise<OrganizationalScope> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return NO_SCOPE;
    if (user.role === 'root' || user.has_full_access) return FULL_SCOPE;
    if (user.role === 'dummy') return NO_SCOPE;

    const deputyScope = await this.orgSettings.getDeputyHasLeadScope(tenantId);
    const cte = buildScopeCte(deputyScope);
    const rows = await this.db.query<ScopeQueryRow>(cte, [userId, tenantId]);
    const row = rows[0];
    if (row === undefined) return NO_SCOPE;

    const scope = buildLimitedScope(row);

    // Employee without any lead position → no manage-page access
    if (user.role === 'employee' && !scope.isAnyLead) return NO_SCOPE;

    return scope;
  }

  /**
   * Get all user IDs visible within a scope (via user_departments + user_teams).
   * Returns 'all' for full scope, empty array for no scope.
   */
  async getVisibleUserIds(scope: OrganizationalScope, tenantId: number): Promise<number[] | 'all'> {
    if (scope.type === 'full') return 'all';
    if (scope.type === 'none') return [];

    if (scope.departmentIds.length === 0 && scope.teamIds.length === 0) {
      return [];
    }

    const deputyScope = await this.orgSettings.getDeputyHasLeadScope(tenantId);
    const query = buildVisibleUsersQuery(deputyScope);
    const rows = await this.db.query<{ id: number }>(query, [
      tenantId,
      scope.departmentIds,
      scope.teamIds,
    ]);
    return rows.map((r: { id: number }) => r.id);
  }

  /** Synchronous check: is an org entity within the given scope? */
  static isEntityInScope(
    scope: OrganizationalScope,
    entityType: 'area' | 'department' | 'team',
    entityId: number,
  ): boolean {
    if (scope.type === 'full') return true;
    if (scope.type === 'none') return false;

    switch (entityType) {
      case 'area':
        return scope.areaIds.includes(entityId);
      case 'department':
        return scope.departmentIds.includes(entityId);
      case 'team':
        return scope.teamIds.includes(entityId);
      default:
        return false;
    }
  }

  // ==========================================================================
  // AREA ACCESS
  // ==========================================================================

  /** Check direct Area permission */
  private async checkAreaAccess(
    userId: number,
    areaId: number,
    permission: PermissionLevel,
    tenantId: number,
  ): Promise<boolean> {
    const rows = await this.db.query<PermissionRow>(
      `SELECT can_read, can_write, can_delete
       FROM admin_area_permissions
       WHERE admin_user_id = $1 AND area_id = $2 AND tenant_id = $3`,
      [userId, areaId, tenantId],
    );

    if (rows.length > 0 && rows[0] !== undefined) {
      return this.hasPermissionLevel(rows[0], permission);
    }

    return false;
  }

  // ==========================================================================
  // DEPARTMENT ACCESS (with Area inheritance)
  // ==========================================================================

  /** Check Department access with Area inheritance (Direct permission then Area inheritance) */
  private async checkDepartmentAccess(
    userId: number,
    departmentId: number,
    permission: PermissionLevel,
    tenantId: number,
  ): Promise<boolean> {
    // 1. Check direct department permission
    const directPerm = await this.db.query<PermissionRow>(
      `SELECT can_read, can_write, can_delete
       FROM admin_department_permissions
       WHERE admin_user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [userId, departmentId, tenantId],
    );

    if (
      directPerm.length > 0 &&
      directPerm[0] !== undefined &&
      this.hasPermissionLevel(directPerm[0], permission)
    ) {
      return true;
    }

    // 2. Check Area inheritance (only if department has area_id)
    const dept = await this.getDepartmentInfo(departmentId, tenantId);
    if (dept !== null && dept.area_id !== null) {
      const hasAreaPerm = await this.checkAreaAccess(userId, dept.area_id, permission, tenantId);
      if (hasAreaPerm) {
        return true;
      }
    }

    // 3. No access
    return false;
  }

  // ==========================================================================
  // TEAM ACCESS (membership only)
  // ==========================================================================

  /** Check Team access (membership only, inherits from Department) */
  private async checkTeamAccess(
    userId: number,
    teamId: number,
    tenantId: number,
  ): Promise<boolean> {
    // 1. Check team membership
    const isMember = await this.isTeamMember(userId, teamId, tenantId);
    if (isMember) {
      return true;
    }

    // 2. Check Department inheritance (if team has department_id)
    const team = await this.getTeamInfo(teamId, tenantId);
    if (team !== null && team.department_id !== null) {
      return await this.checkDepartmentAccess(userId, team.department_id, 'read', tenantId);
    }

    return false;
  }

  // ==========================================================================
  // BATCH ACCESS CHECKS (for filtering lists)
  // ==========================================================================

  /** DEPRECATED: Use getScope() instead — removal after BlackboardAccessService migration (Phase 2.5) */
  async getAccessibleAreaIds(userId: number, tenantId: number): Promise<number[]> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access = all areas
    if (user.role === 'root' || user.has_full_access) {
      const allAreas = await this.db.query<IdRow>(`SELECT id FROM areas WHERE tenant_id = $1`, [
        tenantId,
      ]);
      return allAreas.map((a: IdRow) => a.id);
    }

    // Get directly assigned areas
    const assignedAreas = await this.db.query<AreaIdRow>(
      `SELECT area_id FROM admin_area_permissions
       WHERE admin_user_id = $1 AND tenant_id = $2 AND can_read = true`,
      [userId, tenantId],
    );

    return assignedAreas.map((a: AreaIdRow) => a.area_id);
  }

  /** DEPRECATED: Use getScope() instead — removal after BlackboardAccessService migration (Phase 2.5) */
  async getAccessibleDepartmentIds(userId: number, tenantId: number): Promise<number[]> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access = all departments
    if (user.role === 'root' || user.has_full_access) {
      const allDepts = await this.db.query<IdRow>(
        `SELECT id FROM departments WHERE tenant_id = $1`,
        [tenantId],
      );
      return allDepts.map((d: IdRow) => d.id);
    }

    // Get directly assigned departments
    const directDepts = await this.db.query<DepartmentIdRow>(
      `SELECT department_id FROM admin_department_permissions
       WHERE admin_user_id = $1 AND tenant_id = $2 AND can_read = true`,
      [userId, tenantId],
    );

    const deptSet = new Set<number>(directDepts.map((d: DepartmentIdRow) => d.department_id));

    // Get departments inherited from areas
    const accessibleAreas = await this.getAccessibleAreaIds(userId, tenantId);
    if (accessibleAreas.length > 0) {
      const placeholders = accessibleAreas.map((_: number, i: number) => `$${i + 2}`).join(',');
      const inheritedDepts = await this.db.query<IdRow>(
        `SELECT id FROM departments
         WHERE tenant_id = $1 AND area_id IN (${placeholders})`,
        [tenantId, ...accessibleAreas],
      );
      for (const d of inheritedDepts) {
        deptSet.add(d.id);
      }
    }

    return [...deptSet];
  }

  /** DEPRECATED: Use getScope() instead — removal after BlackboardAccessService migration (Phase 2.5) */
  async getAccessibleTeamIds(userId: number, tenantId: number): Promise<number[]> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access = all teams
    if (user.role === 'root' || user.has_full_access) {
      const allTeams = await this.db.query<IdRow>(`SELECT id FROM teams WHERE tenant_id = $1`, [
        tenantId,
      ]);
      return allTeams.map((t: IdRow) => t.id);
    }

    // Get teams user is member of
    const memberTeams = await this.db.query<TeamIdRow>(
      `SELECT team_id FROM user_teams WHERE user_id = $1`,
      [userId],
    );

    const teamSet = new Set<number>(memberTeams.map((t: TeamIdRow) => t.team_id));

    // Get teams inherited from departments
    const accessibleDepts = await this.getAccessibleDepartmentIds(userId, tenantId);
    if (accessibleDepts.length > 0) {
      const placeholders = accessibleDepts.map((_: number, i: number) => `$${i + 2}`).join(',');
      const inheritedTeams = await this.db.query<IdRow>(
        `SELECT id FROM teams
         WHERE tenant_id = $1 AND department_id IN (${placeholders})`,
        [tenantId, ...accessibleDepts],
      );
      for (const t of inheritedTeams) {
        teamSet.add(t.id);
      }
    }

    return [...teamSet];
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /** Get user info for permission checks */
  private async getUserInfo(userId: number, tenantId: number): Promise<UserInfoRow | null> {
    const rows = await this.db.query<UserInfoRow>(
      `SELECT id, role, has_full_access FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Get department info for inheritance */
  private async getDepartmentInfo(
    departmentId: number,
    tenantId: number,
  ): Promise<DepartmentInfoRow | null> {
    const rows = await this.db.query<DepartmentInfoRow>(
      `SELECT id, area_id FROM departments WHERE id = $1 AND tenant_id = $2`,
      [departmentId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Get team info for inheritance */
  private async getTeamInfo(teamId: number, tenantId: number): Promise<TeamInfoRow | null> {
    const rows = await this.db.query<TeamInfoRow>(
      `SELECT id, department_id FROM teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Check if user is team member */
  private async isTeamMember(userId: number, teamId: number, _tenantId: number): Promise<boolean> {
    const rows = await this.db.query<TeamMemberRow>(
      `SELECT user_id FROM user_teams WHERE user_id = $1 AND team_id = $2`,
      [userId, teamId],
    );
    return rows.length > 0;
  }

  /** Check if permission row has required level */
  private hasPermissionLevel(perm: PermissionRow, level: PermissionLevel): boolean {
    switch (level) {
      case 'read':
        return perm.can_read;
      case 'write':
        return perm.can_write;
      case 'delete':
        return perm.can_delete;
      default:
        return false;
    }
  }
}
