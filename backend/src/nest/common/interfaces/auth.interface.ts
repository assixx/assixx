/**
 * Authentication Interfaces
 *
 * Type definitions for authenticated requests and user data.
 */

/**
 * Valid user roles in the system
 */
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * NestJS Authenticated user data attached to requests
 * Named NestAuthUser to avoid conflict with existing AuthUser during migration
 */
export interface NestAuthUser {
  /** User ID */
  id: number;
  /** User email */
  email: string;
  /** Original role from database */
  role: UserRole;
  /** Active role (may differ due to role switching) */
  activeRole: UserRole;
  /** Whether user is currently viewing as different role */
  isRoleSwitched: boolean;
  /** Tenant ID for multi-tenant isolation */
  tenantId: number;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** Department ID (for employees) */
  departmentId?: number;
  /** Team ID (for employees) */
  teamId?: number;
}

/**
 * JWT token payload structure
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: number;
  /** User ID (alias) */
  id: number;
  /** User email */
  email: string;
  /** User role */
  role: UserRole;
  /** Active role (for role switching) */
  activeRole?: UserRole;
  /** Whether user is currently viewing as different role */
  isRoleSwitched?: boolean;
  /** Tenant ID */
  tenantId: number;
  /** Token type (access/refresh) */
  type: 'access' | 'refresh';
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

/**
 * Valid roles array for validation
 */
export const VALID_ROLES: readonly UserRole[] = [
  'root',
  'admin',
  'employee',
] as const;
