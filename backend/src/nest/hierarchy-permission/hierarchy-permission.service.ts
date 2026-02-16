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
import { Injectable, Logger } from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../database/database.service.js';

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
// SERVICE
// ============================================================================

/** Handles all permission checks with hierarchical inheritance */
@Injectable()
export class HierarchyPermissionService {
  private readonly logger = new Logger(HierarchyPermissionService.name);

  constructor(private readonly db: DatabaseService) {}

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
          return await this.checkAreaAccess(
            userId,
            resourceId,
            permission,
            tenantId,
          );

        case 'department':
          return await this.checkDepartmentAccess(
            userId,
            resourceId,
            permission,
            tenantId,
          );

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
      const hasAreaPerm = await this.checkAreaAccess(
        userId,
        dept.area_id,
        permission,
        tenantId,
      );
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
      return await this.checkDepartmentAccess(
        userId,
        team.department_id,
        'read',
        tenantId,
      );
    }

    return false;
  }

  // ==========================================================================
  // BATCH ACCESS CHECKS (for filtering lists)
  // ==========================================================================

  /** Get all Area IDs user has access to */
  async getAccessibleAreaIds(
    userId: number,
    tenantId: number,
  ): Promise<number[]> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access = all areas
    if (user.role === 'root' || user.has_full_access) {
      const allAreas = await this.db.query<IdRow>(
        `SELECT id FROM areas WHERE tenant_id = $1`,
        [tenantId],
      );
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

  /** Get all Department IDs user has access to (direct + inherited from Areas) */
  async getAccessibleDepartmentIds(
    userId: number,
    tenantId: number,
  ): Promise<number[]> {
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

    const deptSet = new Set<number>(
      directDepts.map((d: DepartmentIdRow) => d.department_id),
    );

    // Get departments inherited from areas
    const accessibleAreas = await this.getAccessibleAreaIds(userId, tenantId);
    if (accessibleAreas.length > 0) {
      const placeholders = accessibleAreas
        .map((_: number, i: number) => `$${i + 2}`)
        .join(',');
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

  /** Get all Team IDs user has access to (membership + inherited from Departments) */
  async getAccessibleTeamIds(
    userId: number,
    tenantId: number,
  ): Promise<number[]> {
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access = all teams
    if (user.role === 'root' || user.has_full_access) {
      const allTeams = await this.db.query<IdRow>(
        `SELECT id FROM teams WHERE tenant_id = $1`,
        [tenantId],
      );
      return allTeams.map((t: IdRow) => t.id);
    }

    // Get teams user is member of
    const memberTeams = await this.db.query<TeamIdRow>(
      `SELECT team_id FROM user_teams WHERE user_id = $1`,
      [userId],
    );

    const teamSet = new Set<number>(
      memberTeams.map((t: TeamIdRow) => t.team_id),
    );

    // Get teams inherited from departments
    const accessibleDepts = await this.getAccessibleDepartmentIds(
      userId,
      tenantId,
    );
    if (accessibleDepts.length > 0) {
      const placeholders = accessibleDepts
        .map((_: number, i: number) => `$${i + 2}`)
        .join(',');
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
  private async getUserInfo(
    userId: number,
    tenantId: number,
  ): Promise<UserInfoRow | null> {
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
  private async getTeamInfo(
    teamId: number,
    tenantId: number,
  ): Promise<TeamInfoRow | null> {
    const rows = await this.db.query<TeamInfoRow>(
      `SELECT id, department_id FROM teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Check if user is team member */
  private async isTeamMember(
    userId: number,
    teamId: number,
    _tenantId: number,
  ): Promise<boolean> {
    const rows = await this.db.query<TeamMemberRow>(
      `SELECT user_id FROM user_teams WHERE user_id = $1 AND team_id = $2`,
      [userId, teamId],
    );
    return rows.length > 0;
  }

  /** Check if permission row has required level */
  private hasPermissionLevel(
    perm: PermissionRow,
    level: PermissionLevel,
  ): boolean {
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
