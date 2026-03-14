/**
 * Blackboard Access Service
 *
 * Handles access control and permission checks for blackboard entries.
 * Implements role-based access control (RBAC) for root, admin, and employee users.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import type {
  DbBlackboardEntry,
  UserAccessInfo,
  UserDepartmentTeam,
} from './blackboard.types.js';

@Injectable()
export class BlackboardAccessService {
  private readonly logger = new Logger(BlackboardAccessService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly scopeService: ScopeService,
  ) {}

  // ==========================================================================
  // USER INFO
  // ==========================================================================

  /**
   * Get user's department and team information for access control.
   */
  async getUserAccessInfo(userId: number): Promise<UserAccessInfo> {
    const query = `
      SELECT
        u.role,
        u.has_full_access,
        ud.department_id as primary_department_id,
        ut.team_id
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
      LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
      WHERE u.id = $1
    `;

    const rows = await this.db.query<UserDepartmentTeam>(query, [userId]);
    const user = rows[0];

    if (user === undefined) {
      return {
        role: null,
        departmentId: null,
        teamId: null,
        hasFullAccess: false,
      };
    }

    return {
      role: user.role,
      departmentId: user.primary_department_id,
      teamId: user.team_id,
      hasFullAccess: user.has_full_access,
    };
  }

  // ==========================================================================
  // ACCESS CONTROL SQL BUILDERS
  // ==========================================================================

  /**
   * Build admin access control SQL fragment.
   * Checks admin permissions across areas, departments, and teams.
   */
  buildAdminAccessSQL(baseIndex: number): string {
    const p1 = baseIndex;
    const p2 = baseIndex + 1;
    const p3 = baseIndex + 2;
    const p4 = baseIndex + 3;
    const p5 = baseIndex + 4;
    return ` AND (
      (e.org_level = 'company' AND NOT EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo WHERE beo.entry_id = e.id
      ))
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
        WHERE beo.entry_id = e.id AND aap.admin_user_id = $${p1}
      )
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $${p2}
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $${p3}
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
        JOIN departments d ON t.department_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $${p4}
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $${p5}
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
    )`;
  }

  /**
   * Apply access control filters based on user role.
   * Returns modified query and params array.
   */
  applyAccessControl(
    query: string,
    params: unknown[],
    role: string | null | undefined,
    departmentId: number | null | undefined,
    teamId: number | null | undefined,
    userId?: number,
    hasFullAccess?: boolean,
  ): { query: string; params: unknown[] } {
    if (role === 'root' || hasFullAccess === true) {
      return { query, params };
    }

    if (role === 'admin' && userId !== undefined) {
      const adminSQL = this.buildAdminAccessSQL(params.length + 1);
      params.push(userId, userId, userId, userId, userId);
      return { query: query + adminSQL, params };
    }

    const deptIdx = params.length + 1;
    const teamIdx = params.length + 2;
    const employeeSQL = ` AND (
      e.org_level = 'company' OR
      (e.org_level = 'department' AND e.org_id = $${deptIdx}) OR
      (e.org_level = 'team' AND e.org_id = $${teamIdx})
    )`;
    params.push(departmentId ?? 0, teamId ?? 0);

    return { query: query + employeeSQL, params };
  }

  // ==========================================================================
  // ENTRY ACCESS CHECKS
  // ==========================================================================

  /**
   * Check if user has access to a specific entry.
   */
  async checkEntryAccess(
    entry: DbBlackboardEntry,
    role: string | null,
    hasFullAccess: boolean,
    userId: number,
    tenantId: number,
    departmentId: number | null,
    teamId: number | null,
  ): Promise<boolean> {
    if (role === 'root' || hasFullAccess) {
      return true;
    }

    if (role === 'admin') {
      return await this.checkAdminEntryAccess(entry.id, userId, tenantId);
    }

    // Employee access
    return (
      entry.org_level === 'company' ||
      (entry.org_level === 'department' && entry.org_id === departmentId) ||
      (entry.org_level === 'team' && entry.org_id === teamId)
    );
  }

  /**
   * Check if admin has access to entry via permission tables.
   */
  async checkAdminEntryAccess(
    entryId: number,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    // Check company-wide entries
    const noAssignments = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entries e
       WHERE e.id = $1 AND e.tenant_id = $2
       AND NOT EXISTS (SELECT 1 FROM blackboard_entry_organizations WHERE entry_id = e.id)`,
      [entryId, tenantId],
    );
    if (noAssignments.length > 0) return true;

    // Check area access
    const areaAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
       WHERE beo.entry_id = $1 AND aap.admin_user_id = $2`,
      [entryId, userId],
    );
    if (areaAccess.length > 0) return true;

    // Check department access
    const deptAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
       LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $1
       LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $2
       WHERE beo.entry_id = $3 AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
      [userId, userId, entryId],
    );
    if (deptAccess.length > 0) return true;

    // Check team access
    const teamAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
       JOIN departments d ON t.department_id = d.id
       LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $1
       LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $2
       WHERE beo.entry_id = $3 AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
      [userId, userId, entryId],
    );
    if (teamAccess.length > 0) return true;

    return false;
  }

  // ==========================================================================
  // ORGANIZATION PERMISSION VALIDATION
  // ==========================================================================

  /**
   * Validate user has permission to assign entry to specified organizations.
   * Uses ScopeService (lazy CLS-cached) instead of 3 separate DB queries.
   * Throws ForbiddenException if any permission is missing.
   */
  async validateOrgPermissions(
    _userId: number,
    _tenantId: number,
    areaIds: number[] = [],
    departmentIds: number[] = [],
    teamIds: number[] = [],
  ): Promise<void> {
    const scope = await this.scopeService.getScope();
    if (scope.type === 'full') return;

    const accessibleAreaSet = new Set(scope.areaIds);
    const accessibleDeptSet = new Set(scope.departmentIds);
    const accessibleTeamSet = new Set(scope.teamIds);

    for (const areaId of areaIds) {
      if (!accessibleAreaSet.has(areaId)) {
        this.logger.warn(`Org permission denied: area ${areaId} not in scope`);
        throw new ForbiddenException(
          `No permission to create entries for area ${areaId}`,
        );
      }
    }

    for (const deptId of departmentIds) {
      if (!accessibleDeptSet.has(deptId)) {
        this.logger.warn(
          `Org permission denied: department ${deptId} not in scope`,
        );
        throw new ForbiddenException(
          `No permission to create entries for department ${deptId}`,
        );
      }
    }

    for (const teamId of teamIds) {
      if (!accessibleTeamSet.has(teamId)) {
        this.logger.warn(`Org permission denied: team ${teamId} not in scope`);
        throw new ForbiddenException(
          `No permission to create entries for team ${teamId}`,
        );
      }
    }
  }
}
