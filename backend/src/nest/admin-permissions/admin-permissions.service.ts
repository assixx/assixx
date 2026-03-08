/**
 * Admin Permissions Service
 *
 * Native NestJS implementation for admin permissions management.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Permission set for read/write/delete access */
export interface PermissionSet {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** Permission level type */
export type PermissionLevel = 'read' | 'write' | 'delete';

/** Area with permission info */
export interface AdminArea {
  id: number;
  name: string;
  description?: string | undefined;
  departmentCount: number;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** Department with permission info */
export interface AdminDepartment {
  id: number;
  name: string;
  description?: string | undefined;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** Group with permission info (DEPRECATED) */
export interface AdminGroup {
  id: number;
  name: string;
  description?: string | undefined;
  departmentCount: number;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** Full response for admin permissions */
export interface AdminPermissionsResponse {
  areas: AdminArea[];
  departments: AdminDepartment[];
  groups: AdminGroup[];
  hasFullAccess: boolean;
  totalAreas: number;
  totalDepartments: number;
  assignedAreas: number;
  assignedDepartments: number;
}

/** Result of a permission check */
export interface PermissionCheckResult {
  hasAccess: boolean;
  source?: 'direct' | 'area' | 'group' | 'full_access' | undefined;
  permissions?: PermissionSet | undefined;
}

/** Result of bulk permission operation */
export interface BulkOperationResult {
  successCount: number;
  totalCount: number;
  errors?: string[] | undefined;
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbDepartmentPermissionRow extends QueryResultRow {
  id: number;
  name: string;
  description: string | null;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface DbAreaPermissionRow extends QueryResultRow {
  id: number;
  name: string;
  description: string | null;
  department_count: number | string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface DbPermissionResult extends QueryResultRow {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface DbRoleResult extends QueryResultRow {
  role: string;
  has_full_access: boolean;
}

interface DbCountResult extends QueryResultRow {
  total: number | string;
}

interface DbAffectedRows extends QueryResultRow {
  affected_rows?: number;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class AdminPermissionsService {
  private readonly logger = new Logger(AdminPermissionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Get permissions for a specific admin/user
   */
  async getAdminPermissions(
    userId: number,
    tenantId: number,
  ): Promise<AdminPermissionsResponse> {
    this.logger.debug(
      `Getting permissions for user ${userId}, tenant ${tenantId}`,
    );

    const { hasFullAccess } = await this.getUserRoleInfo(userId, tenantId);
    const areas = await this.getAreaPermissions(userId, tenantId);
    const departments = await this.getDepartmentPermissions(userId, tenantId);
    const groups = this.getGroupPermissions(); // DEPRECATED: returns empty array
    const totalAreas = await this.getTotalAreas(tenantId);
    const totalDepartments = await this.getTotalDepartments(tenantId);

    return {
      areas,
      departments,
      groups,
      hasFullAccess,
      totalAreas,
      totalDepartments,
      assignedAreas: areas.length,
      assignedDepartments: departments.length,
    };
  }

  async setDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(`Setting department permissions for admin ${adminId}`);

    // Remove existing permissions
    await this.db.query(
      'DELETE FROM admin_department_permissions WHERE admin_user_id = $1 AND tenant_id = $2',
      [adminId, tenantId],
    );

    // Insert new permissions
    if (departmentIds.length > 0) {
      await this.insertDepartmentPermissions(
        adminId,
        departmentIds,
        permissions,
        modifiedBy,
        tenantId,
      );
    }

    // Audit log
    await this.createAuditLog(
      'update_admin_permissions',
      modifiedBy,
      tenantId,
      `Updated permissions for admin ${adminId}: ${departmentIds.length} depts`,
    );

    void this.activityLogger.logUpdate(
      tenantId,
      modifiedBy,
      'admin_permission',
      adminId,
      `Abteilungsberechtigungen aktualisiert für Admin ${adminId}: ${departmentIds.length} Abteilungen`,
      undefined,
      { departmentIds, permissions },
    );
  }

  /**
   * Set group permissions for an admin (DEPRECATED)
   * Department groups were removed in the permission system refactoring (2025-11-27).
   * Use Area permissions (setAreaPermissions) for logical groupings instead.
   */
  setGroupPermissions(
    _adminId: number,
    groupIds: number[],
    _permissions: PermissionSet,
    _modifiedBy: number,
    _tenantId: number,
  ): void {
    if (groupIds.length > 0) {
      this.logger.warn(
        '[DEPRECATED] setGroupPermissions called but department_groups system was removed. Use setAreaPermissions instead.',
      );
    }
    // No-op for backwards compatibility
  }

  async removeDepartmentPermission(
    adminId: number,
    departmentId: number,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(
      `Removing department permission for admin ${adminId}, dept ${departmentId}`,
    );

    const result = await this.db.query<DbAffectedRows>(
      `DELETE FROM admin_department_permissions
       WHERE admin_user_id = $1 AND department_id = $2 AND tenant_id = $3
       RETURNING 1`,
      [adminId, departmentId, tenantId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Permission not found');
    }

    await this.createAuditLog(
      'revoke_admin_permission',
      modifiedBy,
      tenantId,
      `Revoked department permission for admin ${adminId} on department ${departmentId}`,
    );

    void this.activityLogger.logDelete(
      tenantId,
      modifiedBy,
      'admin_permission',
      adminId,
      `Abteilungsberechtigung entzogen für Admin ${adminId}, Abteilung ${departmentId}`,
      { departmentId },
    );
  }

  /**
   * Remove group permission (DEPRECATED)
   * Department groups were removed. Use removeAreaPermission instead.
   */
  removeGroupPermission(
    _adminId: number,
    _groupId: number,
    _modifiedBy: number,
    _tenantId: number,
  ): never {
    this.logger.warn(
      '[DEPRECATED] removeGroupPermission called but department_groups system was removed. Use removeAreaPermission instead.',
    );
    throw new NotFoundException(
      'Group permissions system has been removed. Use Area permissions instead.',
    );
  }

  /** Process permission update for a single admin */
  private async processAdminPermission(
    adminId: number,
    operation: 'assign' | 'remove',
    departmentIds: number[] | undefined,
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<{ success: boolean; error?: string }> {
    const hasValidDepts =
      departmentIds !== undefined && departmentIds.length > 0;
    const shouldAssign = operation === 'assign' && hasValidDepts;
    const shouldRemove = operation === 'remove';

    if (!shouldAssign && !shouldRemove) {
      return { success: false };
    }

    const deptIds = shouldAssign ? departmentIds : [];
    await this.setDepartmentPermissions(
      adminId,
      deptIds,
      permissions,
      modifiedBy,
      tenantId,
    );
    return { success: true };
  }

  /**
   * Bulk update permissions for multiple admins
   */
  async bulkUpdatePermissions(
    adminIds: number[],
    operation: 'assign' | 'remove',
    departmentIds: number[] | undefined,
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<BulkOperationResult> {
    this.logger.log(`Bulk updating permissions for ${adminIds.length} admins`);

    let successCount = 0;
    const errors: string[] = [];

    for (const adminId of adminIds) {
      try {
        const result = await this.processAdminPermission(
          adminId,
          operation,
          departmentIds,
          permissions,
          modifiedBy,
          tenantId,
        );
        if (result.success) {
          successCount++;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Admin ${adminId}: ${msg}`);
      }
    }

    return {
      successCount,
      totalCount: adminIds.length,
      ...(errors.length > 0 && { errors }),
    };
  }

  /**
   * Check if admin has access to a department
   */
  async checkAccess(
    adminId: number,
    departmentId: number,
    tenantId: number,
    permissionLevel: PermissionLevel = 'read',
  ): Promise<PermissionCheckResult> {
    this.logger.log(
      `Checking access for admin ${adminId} to department ${departmentId}`,
    );

    // Check direct department permissions
    const directPermissions = await this.db.query<DbPermissionResult>(
      `SELECT can_read, can_write, can_delete
       FROM admin_department_permissions
       WHERE admin_user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [adminId, departmentId, tenantId],
    );

    const perm = directPermissions[0];
    if (perm !== undefined) {
      const hasAccess = this.checkPermissionLevel(perm, permissionLevel);
      return {
        hasAccess,
        source: 'direct',
        permissions: {
          canRead: perm.can_read,
          canWrite: perm.can_write,
          canDelete: perm.can_delete,
        },
      };
    }

    // NOTE: Group permissions removed (2025-11-27)
    // Use Area permissions for logical groupings instead

    return { hasAccess: false };
  }

  /**
   * Set area permissions for a user
   * Also cleans up user_departments and user_teams entries that are outside the allowed areas
   */
  async setAreaPermissions(
    userId: number,
    areaIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(`Setting area permissions for user ${userId}`);

    // Remove existing area permissions
    await this.db.query(
      'DELETE FROM admin_area_permissions WHERE admin_user_id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );

    // Insert new permissions
    if (areaIds.length > 0) {
      const values: unknown[] = [];
      const valueSets: string[] = [];
      let paramIndex = 1;

      for (const areaId of areaIds) {
        valueSets.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`,
        );
        values.push(
          tenantId,
          userId,
          areaId,
          permissions.canRead,
          permissions.canWrite,
          permissions.canDelete,
          modifiedBy,
        );
        paramIndex += 7;
      }

      await this.db.query(
        `INSERT INTO admin_area_permissions
         (tenant_id, admin_user_id, area_id, can_read, can_write, can_delete, assigned_by)
         VALUES ${valueSets.join(', ')}`,
        values,
      );
    }

    // Clean up user_departments outside allowed areas
    await this.cleanupEmployeeMemberships(userId, areaIds, tenantId);

    await this.createAuditLog(
      'update_admin_area_permissions',
      modifiedBy,
      tenantId,
      `Updated area permissions for user ${userId}: ${areaIds.length} areas`,
    );

    void this.activityLogger.logUpdate(
      tenantId,
      modifiedBy,
      'admin_permission',
      userId,
      `Bereichsberechtigungen aktualisiert für User ${userId}: ${areaIds.length} Bereiche`,
      undefined,
      { areaIds, permissions },
    );
  }

  /**
   * Clean up user_departments and user_teams entries that are outside the allowed areas
   * This ensures admin permissions and employee memberships stay in sync
   */
  private async cleanupEmployeeMemberships(
    userId: number,
    allowedAreaIds: number[],
    tenantId: number,
  ): Promise<void> {
    if (allowedAreaIds.length === 0) {
      // No area permissions = remove ALL employee memberships
      this.logger.log(
        `Removing all employee memberships for user ${userId} (no area permissions)`,
      );

      await this.db.query(
        'DELETE FROM user_teams WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId],
      );
      await this.db.query(
        'DELETE FROM user_departments WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId],
      );
      return;
    }

    // Remove user_teams for teams in departments outside allowed areas
    const teamsDeleted = await this.db.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM user_teams ut
        WHERE ut.user_id = $1
          AND ut.tenant_id = $2
          AND ut.team_id IN (
            SELECT t.id FROM teams t
            JOIN departments d ON t.department_id = d.id
            WHERE d.area_id IS NULL OR d.area_id NOT IN (SELECT unnest($3::int[]))
          )
        RETURNING 1
      ) SELECT COUNT(*)::text as count FROM deleted`,
      [userId, tenantId, allowedAreaIds],
    );
    this.logger.debug(
      `Removed ${teamsDeleted[0]?.count ?? 0} team memberships outside allowed areas`,
    );

    // Remove user_departments for departments outside allowed areas
    const deptsDeleted = await this.db.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM user_departments ud
        WHERE ud.user_id = $1
          AND ud.tenant_id = $2
          AND ud.department_id IN (
            SELECT d.id FROM departments d
            WHERE d.area_id IS NULL OR d.area_id NOT IN (SELECT unnest($3::int[]))
          )
        RETURNING 1
      ) SELECT COUNT(*)::text as count FROM deleted`,
      [userId, tenantId, allowedAreaIds],
    );
    this.logger.debug(
      `Removed ${deptsDeleted[0]?.count ?? 0} department memberships outside allowed areas`,
    );
  }

  async removeAreaPermission(
    userId: number,
    areaId: number,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(
      `Removing area permission for user ${userId}, area ${areaId}`,
    );

    const result = await this.db.query<DbAffectedRows>(
      `DELETE FROM admin_area_permissions
       WHERE admin_user_id = $1 AND area_id = $2 AND tenant_id = $3
       RETURNING 1`,
      [userId, areaId, tenantId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Area permission not found');
    }

    await this.createAuditLog(
      'revoke_admin_area_permission',
      modifiedBy,
      tenantId,
      `Revoked area permission for user ${userId} on area ${areaId}`,
    );

    void this.activityLogger.logDelete(
      tenantId,
      modifiedBy,
      'admin_permission',
      userId,
      `Bereichsberechtigung entzogen für User ${userId}, Bereich ${areaId}`,
      { areaId },
    );
  }

  async setHasFullAccess(
    userId: number,
    hasFullAccess: boolean,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(`Setting full access for user ${userId}: ${hasFullAccess}`);

    // SECURITY: Employees MUST NOT have has_full_access=true
    // Defense-in-depth: DB constraint chk_employee_no_full_access also enforces this
    if (hasFullAccess) {
      const { role } = await this.getUserRoleInfo(userId, tenantId);
      if (role === 'employee') {
        throw new BadRequestException(
          'Mitarbeiter dürfen keinen Vollzugriff erhalten. Nur Admin- und Root-Benutzer können has_full_access=true haben.',
        );
      }
    }

    const result = await this.db.query<DbAffectedRows>(
      `UPDATE users SET has_full_access = $1 WHERE id = $2 AND tenant_id = $3 RETURNING 1`,
      [hasFullAccess, userId, tenantId],
    );

    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }

    await this.createAuditLog(
      hasFullAccess ? 'grant_full_access' : 'revoke_full_access',
      modifiedBy,
      tenantId,
      `${hasFullAccess ? 'Granted' : 'Revoked'} full access for user ${userId}`,
    );

    void this.activityLogger.logUpdate(
      tenantId,
      modifiedBy,
      'admin_permission',
      userId,
      `Vollzugriff ${hasFullAccess ? 'gewährt' : 'entzogen'} für User ${userId}`,
      undefined,
      { hasFullAccess },
    );
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Get user role and has_full_access status
   * SECURITY: Only return role info for ACTIVE users (is_active = 1)
   */
  private async getUserRoleInfo(
    userId: number,
    tenantId: number,
  ): Promise<{ role: string; isRoot: boolean; hasFullAccess: boolean }> {
    const rows = await this.db.query<DbRoleResult>(
      `SELECT role, has_full_access FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );

    if (rows.length === 0) {
      this.logger.error(
        `User not found or inactive - userId: ${userId}, tenantId: ${tenantId}`,
      );
      throw new NotFoundException('User not found or inactive');
    }

    const userRow = rows[0];
    if (userRow === undefined) {
      throw new NotFoundException('User not found or inactive');
    }

    return {
      role: userRow.role,
      isRoot: userRow.role === 'root',
      hasFullAccess: userRow.has_full_access,
    };
  }

  private async getAreaPermissions(
    userId: number,
    tenantId: number,
  ): Promise<AdminArea[]> {
    const rows = await this.db.query<DbAreaPermissionRow>(
      `SELECT
        a.id,
        a.name,
        a.description,
        COUNT(DISTINCT d.id) as department_count,
        aap.can_read,
        aap.can_write,
        aap.can_delete
      FROM admin_area_permissions aap
      JOIN areas a ON aap.area_id = a.id
      LEFT JOIN departments d ON d.area_id = a.id AND d.tenant_id = a.tenant_id
      WHERE aap.admin_user_id = $1 AND aap.tenant_id = $2
      GROUP BY a.id, a.name, a.description, aap.can_read, aap.can_write, aap.can_delete
      ORDER BY a.name`,
      [userId, tenantId],
    );

    return rows.map((row: DbAreaPermissionRow) => {
      const result: AdminArea = {
        id: row.id,
        name: row.name,
        departmentCount: Number(row.department_count),
        canRead: row.can_read,
        canWrite: row.can_write,
        canDelete: row.can_delete,
      };
      if (row.description !== null) {
        result.description = row.description;
      }
      return result;
    });
  }

  private async getDepartmentPermissions(
    adminId: number,
    tenantId: number,
  ): Promise<AdminDepartment[]> {
    const rows = await this.db.query<DbDepartmentPermissionRow>(
      `SELECT
        d.id,
        d.name,
        d.description,
        adp.can_read,
        adp.can_write,
        adp.can_delete
      FROM admin_department_permissions adp
      JOIN departments d ON adp.department_id = d.id
      WHERE adp.admin_user_id = $1
        AND adp.tenant_id = $2
        AND d.is_active = ${IS_ACTIVE.ACTIVE}
      ORDER BY d.name`,
      [adminId, tenantId],
    );

    return rows.map((row: DbDepartmentPermissionRow) => {
      const result: AdminDepartment = {
        id: row.id,
        name: row.name,
        canRead: row.can_read,
        canWrite: row.can_write,
        canDelete: row.can_delete,
      };
      if (row.description !== null) {
        result.description = row.description;
      }
      return result;
    });
  }

  /**
   * Get group permissions (DEPRECATED)
   * Returns empty array as department_groups system was removed (2025-11-27)
   */
  private getGroupPermissions(): AdminGroup[] {
    return [];
  }

  private async getTotalAreas(tenantId: number): Promise<number> {
    const rows = await this.db.query<DbCountResult>(
      'SELECT COUNT(*) as total FROM areas WHERE tenant_id = $1',
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async getTotalDepartments(tenantId: number): Promise<number> {
    const rows = await this.db.query<DbCountResult>(
      `SELECT COUNT(*) as total FROM departments WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async insertDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    const values: unknown[] = [];
    const valueSets: string[] = [];
    let paramIndex = 1;

    for (const deptId of departmentIds) {
      valueSets.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`,
      );
      values.push(
        adminId,
        deptId,
        tenantId,
        permissions.canRead,
        permissions.canWrite,
        permissions.canDelete,
        modifiedBy,
      );
      paramIndex += 7;
    }

    await this.db.query(
      `INSERT INTO admin_department_permissions
       (admin_user_id, department_id, tenant_id, can_read, can_write, can_delete, assigned_by)
       VALUES ${valueSets.join(', ')}`,
      values,
    );
  }

  /**
   * Check if permission result satisfies required level
   */
  private checkPermissionLevel(
    permission: DbPermissionResult,
    requiredLevel: PermissionLevel,
  ): boolean {
    switch (requiredLevel) {
      case 'read':
        return permission.can_read;
      case 'write':
        return permission.can_write;
      case 'delete':
        return permission.can_delete;
      default:
        return false;
    }
  }

  private async createAuditLog(
    action: string,
    userId: number,
    tenantId: number,
    details: string,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO root_logs (action, user_id, tenant_id, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [action, userId, tenantId, details],
      );
    } catch (error: unknown) {
      // Don't fail the main operation if audit logging fails
      this.logger.error('Failed to create audit log:', error);
    }
  }
}
