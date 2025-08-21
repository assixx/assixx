/**
 * Roles API v2 Types
 * Type definitions for role management
 */

export type RoleName = 'admin' | 'employee' | 'root';

export interface Role {
  id: RoleName;
  name: string;
  description: string;
  level: number;
  permissions: string[];
}

export interface RolesResponse {
  success: boolean;
  data: Role[];
}

export interface SingleRoleResponse {
  success: boolean;
  data: Role;
}

export interface RoleCheckRequest {
  userId: number;
  requiredRole: RoleName;
}

export interface RoleCheckResponse {
  success: boolean;
  data: {
    hasRole: boolean;
    userRole: RoleName;
    requiredRole: RoleName;
    hasAccess: boolean;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 *
 */
export class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   */
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
