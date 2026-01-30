/**
 * Authentication Interfaces
 *
 * Type definitions for authenticated requests and user data.
 * Imports shared types from \@assixx/shared, extends with backend-specific fields.
 */
import type { BaseAuthUser, UserRole } from '@assixx/shared';

// Re-export for backward compatibility (existing imports from this file still work)
export type { UserRole };

/**
 * NestJS Authenticated user data attached to requests.
 * Extends BaseAuthUser with backend-specific fields.
 */
export interface NestAuthUser extends BaseAuthUser {
  /** Active role (may differ due to role switching) */
  activeRole: UserRole;
  /** Whether user is currently viewing as different role */
  isRoleSwitched: boolean;
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
