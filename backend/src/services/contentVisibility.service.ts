/**
 * Content Visibility Service
 * Handles "who can see this content?" logic for features like Blackboard, Documents, etc.
 *
 * Visibility Types:
 * - tenant: Everyone in the tenant can see
 * - area: Users with Area access can see
 * - department: Users with Department access can see
 * - team: Only Team members can see
 *
 * This is DIFFERENT from hierarchyPermission.service.ts:
 * - hierarchyPermission: "What can user X access?"
 * - contentVisibility: "Who can see content Y?"
 *
 * Part of Assignment System Refactoring (2025-11-27)
 */
import { RowDataPacket } from 'mysql2/promise';

import { execute } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { hierarchyPermissionService } from './hierarchyPermission.service.js';

// ============================================================================
// TYPES
// ============================================================================

/** Visibility levels for content */
export type VisibilityType = 'tenant' | 'area' | 'department' | 'team';

/** Content visibility configuration */
export interface ContentVisibility {
  visibilityType: VisibilityType;
  visibilityId: number | null; // null for 'tenant' type
}

/** User info for visibility checks */
interface UserInfoRow extends RowDataPacket {
  id: number;
  role: string;
  has_full_access: number;
  tenant_id: number;
}

/** Team member check result */
interface TeamMemberRow extends RowDataPacket {
  user_id: number;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Content Visibility Service
 * Determines if a user can see specific content
 */
class ContentVisibilityService {
  // ==========================================================================
  // MAIN VISIBILITY CHECK
  // ==========================================================================

  /**
   * Check if user can see content with given visibility settings
   *
   * @param userId - User requesting to view content
   * @param tenantId - Tenant context
   * @param visibilityType - Content visibility type
   * @param visibilityId - Target ID (area_id, department_id, team_id) or null for tenant
   */
  async canUserSeeContent(
    userId: number,
    tenantId: number,
    visibilityType: VisibilityType,
    visibilityId: number | null,
  ): Promise<boolean> {
    try {
      // Step 1: Get user info
      const user = await this.getUserInfo(userId, tenantId);
      if (user === null) {
        logger.warn(`[ContentVisibility] User not found: ${userId}`);
        return false;
      }

      // Step 2: Root or has_full_access sees everything
      if (user.role === 'root' || user.has_full_access === 1) {
        return true;
      }

      // Step 3: Delegate to visibility type handler
      return await this.checkVisibilityByType(userId, tenantId, visibilityType, visibilityId);
    } catch (error: unknown) {
      logger.error('[ContentVisibility] Error in canUserSeeContent:', error);
      return false;
    }
  }

  /**
   * Check visibility based on type (extracted to reduce complexity)
   */
  private async checkVisibilityByType(
    userId: number,
    tenantId: number,
    visibilityType: VisibilityType,
    visibilityId: number | null,
  ): Promise<boolean> {
    switch (visibilityType) {
      case 'tenant':
        return true;

      case 'area':
        return await this.checkResourceVisibility(userId, tenantId, 'area', visibilityId, 'Area');

      case 'department':
        return await this.checkResourceVisibility(
          userId,
          tenantId,
          'department',
          visibilityId,
          'Department',
        );

      case 'team':
        if (visibilityId === null) {
          logger.warn('[ContentVisibility] Team visibility requires visibilityId');
          return false;
        }
        return await this.isTeamMember(userId, visibilityId);

      default:
        logger.warn(`[ContentVisibility] Unknown visibility type: ${String(visibilityType)}`);
        return false;
    }
  }

  /**
   * Check resource visibility (area or department)
   */
  private async checkResourceVisibility(
    userId: number,
    tenantId: number,
    resourceType: 'area' | 'department',
    visibilityId: number | null,
    resourceName: string,
  ): Promise<boolean> {
    if (visibilityId === null) {
      logger.warn(`[ContentVisibility] ${resourceName} visibility requires visibilityId`);
      return false;
    }
    return await hierarchyPermissionService.hasAccess(
      userId,
      tenantId,
      resourceType,
      visibilityId,
      'read',
    );
  }

  // ==========================================================================
  // BATCH CHECKS (for filtering lists)
  // ==========================================================================

  /**
   * Filter content list based on user's visibility access
   * Returns only content items the user can see
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param items - Array of items with visibility info
   */
  async filterVisibleContent<T extends ContentVisibility>(
    userId: number,
    tenantId: number,
    items: T[],
  ): Promise<T[]> {
    // Get user info once
    const user = await this.getUserInfo(userId, tenantId);
    if (user === null) return [];

    // Root or full access sees everything
    if (user.role === 'root' || user.has_full_access === 1) {
      return items;
    }

    // Pre-fetch accessible IDs for efficiency
    const accessibleAreas = await hierarchyPermissionService.getAccessibleAreaIds(userId, tenantId);
    const accessibleDepts = await hierarchyPermissionService.getAccessibleDepartmentIds(
      userId,
      tenantId,
    );
    const accessibleTeams = await hierarchyPermissionService.getAccessibleTeamIds(userId, tenantId);

    const areaSet = new Set(accessibleAreas);
    const deptSet = new Set(accessibleDepts);
    const teamSet = new Set(accessibleTeams);

    // Filter items
    return items.filter((item: T) => {
      switch (item.visibilityType) {
        case 'tenant':
          return true;
        case 'area':
          return item.visibilityId !== null && areaSet.has(item.visibilityId);
        case 'department':
          return item.visibilityId !== null && deptSet.has(item.visibilityId);
        case 'team':
          return item.visibilityId !== null && teamSet.has(item.visibilityId);
        default:
          return false;
      }
    });
  }

  /**
   * Get user IDs who can see content with given visibility
   * Useful for notifications
   *
   * @param tenantId - Tenant ID
   * @param visibilityType - Visibility type
   * @param visibilityId - Target ID or null for tenant
   */
  async getUsersWhoCanSee(
    tenantId: number,
    visibilityType: VisibilityType,
    visibilityId: number | null,
  ): Promise<number[]> {
    try {
      switch (visibilityType) {
        case 'tenant':
          return await this.getAllTenantUserIds(tenantId);

        case 'area':
          if (visibilityId === null) return [];
          return await this.getUsersWithAreaAccess(tenantId, visibilityId);

        case 'department':
          if (visibilityId === null) return [];
          return await this.getUsersWithDepartmentAccess(tenantId, visibilityId);

        case 'team':
          if (visibilityId === null) return [];
          return await this.getTeamMemberIds(visibilityId);

        default:
          return [];
      }
    } catch (error: unknown) {
      logger.error('[ContentVisibility] Error in getUsersWhoCanSee:', error);
      return [];
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Get user info
   */
  private async getUserInfo(userId: number, tenantId: number): Promise<UserInfoRow | null> {
    const [rows] = await execute<UserInfoRow[]>(
      `SELECT id, role, has_full_access, tenant_id
       FROM users WHERE id = ? AND tenant_id = ?`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Check if user is team member
   */
  private async isTeamMember(userId: number, teamId: number): Promise<boolean> {
    const [rows] = await execute<TeamMemberRow[]>(
      `SELECT user_id FROM user_teams WHERE user_id = ? AND team_id = ?`,
      [userId, teamId],
    );
    return rows.length > 0;
  }

  /**
   * Get all user IDs in tenant
   */
  private async getAllTenantUserIds(tenantId: number): Promise<number[]> {
    const [rows] = await execute<{ id: number }[] & RowDataPacket[]>(
      `SELECT id FROM users WHERE tenant_id = ? AND is_archived = 0`,
      [tenantId],
    );
    return rows.map((r: { id: number }) => r.id);
  }

  /**
   * Get user IDs with Area access (direct + root + has_full_access)
   */
  private async getUsersWithAreaAccess(tenantId: number, areaId: number): Promise<number[]> {
    const [rows] = await execute<{ id: number }[] & RowDataPacket[]>(
      `SELECT DISTINCT u.id FROM users u
       LEFT JOIN admin_area_permissions aap ON u.id = aap.admin_user_id AND aap.tenant_id = u.tenant_id
       WHERE u.tenant_id = ? AND u.is_archived = 0
       AND (u.role = 'root' OR u.has_full_access = 1 OR aap.area_id = ?)`,
      [tenantId, areaId],
    );
    return rows.map((r: { id: number }) => r.id);
  }

  /**
   * Get user IDs with Department access (direct + via area + root + has_full_access)
   */
  private async getUsersWithDepartmentAccess(
    tenantId: number,
    departmentId: number,
  ): Promise<number[]> {
    // This is complex because of Area inheritance
    // Users with: direct dept permission, or area permission for dept's area, or root, or has_full_access
    const [rows] = await execute<{ id: number }[] & RowDataPacket[]>(
      `SELECT DISTINCT u.id FROM users u
       LEFT JOIN admin_department_permissions adp ON u.id = adp.admin_user_id AND adp.tenant_id = u.tenant_id
       LEFT JOIN departments d ON d.id = ? AND d.tenant_id = u.tenant_id
       LEFT JOIN admin_area_permissions aap ON u.id = aap.admin_user_id AND aap.area_id = d.area_id AND aap.tenant_id = u.tenant_id
       WHERE u.tenant_id = ? AND u.is_archived = 0
       AND (u.role = 'root' OR u.has_full_access = 1 OR adp.department_id = ? OR aap.area_id IS NOT NULL)`,
      [departmentId, tenantId, departmentId],
    );
    return rows.map((r: { id: number }) => r.id);
  }

  /**
   * Get team member user IDs (+ root + has_full_access users)
   */
  private async getTeamMemberIds(teamId: number): Promise<number[]> {
    const [rows] = await execute<{ user_id: number; tenant_id: number }[] & RowDataPacket[]>(
      `SELECT ut.user_id, u.tenant_id FROM user_teams ut
       JOIN users u ON ut.user_id = u.id
       WHERE ut.team_id = ? AND u.is_archived = 0`,
      [teamId],
    );

    if (rows.length === 0) return [];

    const tenantId = rows[0]?.tenant_id;
    if (tenantId === undefined) return rows.map((r: { user_id: number }) => r.user_id);

    // Also include root and has_full_access users
    const [adminRows] = await execute<{ id: number }[] & RowDataPacket[]>(
      `SELECT id FROM users
       WHERE tenant_id = ? AND is_archived = 0 AND (role = 'root' OR has_full_access = 1)`,
      [tenantId],
    );

    const userSet = new Set(rows.map((r: { user_id: number }) => r.user_id));
    for (const r of adminRows) {
      userSet.add(r.id);
    }

    return [...userSet];
  }
}

// Export singleton instance
export const contentVisibilityService = new ContentVisibilityService();
export default contentVisibilityService;
