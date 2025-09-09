/**
 * Roles Service v2
 * Business logic for role management
 */
import { RowDataPacket } from 'mysql2/promise';

import { ServiceError } from '../../../utils/ServiceError.js';
import { execute } from '../../../utils/db.js';
import { logger } from '../../../utils/logger.js';
import { Role, RoleCheckRequest, RoleName } from './types.js';

/**
 *
 */
export class RolesService {
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
      description: 'Regular employee with limited access to their own data and assigned features.',
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
    return Object.values(RolesService.ROLES);
  }

  /**
   * Get a single role by ID
   * @param roleId - The roleId parameter
   */
  getRoleById(roleId: RoleName): Role {
    // TypeScript ensures roleId is a valid RoleName, so role is always defined
    // ESLint disable needed: roleId is typed as RoleName union, not arbitrary string
    // eslint-disable-next-line security/detect-object-injection
    return RolesService.ROLES[roleId];
  }

  /**
   * Check if a user has a specific role
   * @param request - The request parameter
   */
  async checkUserRole(request: RoleCheckRequest): Promise<{
    hasRole: boolean;
    userRole: RoleName;
    requiredRole: RoleName;
    hasAccess: boolean;
  }> {
    try {
      // Get user's current role from database
      const [rows] = await execute<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [
        request.userId,
      ]);

      if (rows.length === 0) {
        throw new ServiceError('NOT_FOUND', 'User not found');
      }

      const userRole = rows[0].role as RoleName;
      // ESLint disable needed: userRole is cast to RoleName type, not arbitrary string
      // eslint-disable-next-line security/detect-object-injection
      const userRoleLevel = RolesService.ROLES[userRole].level;
      const requiredRoleLevel = RolesService.ROLES[request.requiredRole].level;

      return {
        hasRole: userRole === request.requiredRole,
        userRole,
        requiredRole: request.requiredRole,
        hasAccess: userRoleLevel >= requiredRoleLevel, // Higher level = more access
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error checking user role:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to check user role');
    }
  }

  /**
   * Get role hierarchy (for display purposes)
   */
  getRoleHierarchy(): {
    hierarchy: {
      role: Role;
      canManage: RoleName[];
    }[];
  } {
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
   * Get roles available for assignment by current user role
   * @param currentUserRole - The currentUserRole parameter
   */
  getAssignableRoles(currentUserRole: RoleName): Role[] {
    switch (currentUserRole) {
      case 'root':
        // Root can assign all roles
        return [RolesService.ROLES.admin, RolesService.ROLES.employee, RolesService.ROLES.root];
      case 'admin':
        // Admin can only assign employee role
        return [RolesService.ROLES.employee];
      case 'employee':
        // Employees cannot assign roles
        return [];
      default:
        return [];
    }
  }
}

export const rolesService = new RolesService();
