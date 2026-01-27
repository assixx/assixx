/**
 * Roles Service
 *
 * Business logic for role management.
 * Roles are statically defined - only checkUserRole requires database access.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';
import type { RoleName } from './dto/index.js';

/**
 * Role definition interface
 */
export interface Role {
  id: RoleName;
  name: string;
  description: string;
  level: number;
  permissions: string[];
}

/**
 * Role hierarchy entry
 */
export interface RoleHierarchyEntry {
  role: Role;
  canManage: RoleName[];
}

/**
 * Role check result
 */
export interface RoleCheckResult {
  hasRole: boolean;
  userRole: RoleName;
  requiredRole: RoleName;
  hasAccess: boolean;
}

/**
 * Database user role query result
 */
interface UserRoleRow extends RowDataPacket {
  role: string;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  /**
   * Static role definitions
   */
  private static readonly ROLES: Record<RoleName, Role> = {
    root: {
      id: 'root',
      name: 'Root Administrator',
      description:
        'Super administrator with full system access. Can manage all tenants and system settings.',
      level: 100,
      permissions: [
        'system.manage',
        'tenants.manage',
        'users.manage.all',
        'settings.manage.all',
        'logs.view.all',
        'api.access.all',
      ],
    },
    admin: {
      id: 'admin',
      name: 'Administrator',
      description: 'Tenant administrator with full access within their tenant.',
      level: 50,
      permissions: [
        'users.manage',
        'departments.manage',
        'teams.manage',
        'settings.manage',
        'reports.view',
        'employees.manage',
      ],
    },
    employee: {
      id: 'employee',
      name: 'Employee',
      description:
        'Regular employee with limited access to their own data and assigned features.',
      level: 10,
      permissions: [
        'profile.view.own',
        'profile.edit.own',
        'shifts.view.own',
        'documents.view.assigned',
        'kvp.create',
        'surveys.respond',
      ],
    },
  };

  /**
   * Get all available roles
   */
  getAllRoles(): Role[] {
    this.logger.debug('Getting all roles');
    return Object.values(RolesService.ROLES);
  }

  /**
   * Get a single role by ID
   */
  getRoleById(roleId: RoleName): Role {
    this.logger.debug(`Getting role: ${roleId}`);
    // TypeScript ensures roleId is a valid RoleName union type, not arbitrary string

    return RolesService.ROLES[roleId];
  }

  /**
   * Get role hierarchy
   */
  getRoleHierarchy(): { hierarchy: RoleHierarchyEntry[] } {
    this.logger.debug('Getting role hierarchy');
    return {
      hierarchy: [
        {
          role: RolesService.ROLES.root,
          canManage: ['admin', 'employee'],
        },
        {
          role: RolesService.ROLES.admin,
          canManage: ['employee'],
        },
        {
          role: RolesService.ROLES.employee,
          canManage: [],
        },
      ],
    };
  }

  /**
   * Get roles that can be assigned by current user
   */
  getAssignableRoles(currentUserRole: RoleName): Role[] {
    this.logger.debug(`Getting assignable roles for: ${currentUserRole}`);

    switch (currentUserRole) {
      case 'root':
        return [
          RolesService.ROLES.admin,
          RolesService.ROLES.employee,
          RolesService.ROLES.root,
        ];
      case 'admin':
        return [RolesService.ROLES.employee];
      case 'employee':
        return [];
      default:
        return [];
    }
  }

  /**
   * Check if a user has a specific role
   */
  async checkUserRole(
    userId: number,
    tenantId: number,
    requiredRole: RoleName,
  ): Promise<RoleCheckResult> {
    this.logger.log(
      `Checking role for user ${userId}, required: ${requiredRole}`,
    );

    // SECURITY: Only check roles for ACTIVE users (is_active = 1)
    const [rows] = await execute<UserRoleRow[]>(
      'SELECT role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1',
      [userId, tenantId],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException('User not found or inactive');
    }

    const userRole = rows[0].role as RoleName;
    // userRole and requiredRole are typed as RoleName union, not arbitrary strings

    const userRoleLevel = RolesService.ROLES[userRole].level;

    const requiredRoleLevel = RolesService.ROLES[requiredRole].level;

    return {
      hasRole: userRole === requiredRole,
      userRole,
      requiredRole,
      hasAccess: userRoleLevel >= requiredRoleLevel,
    };
  }
}
