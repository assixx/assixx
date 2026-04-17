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
  /** Full access flag — root always true, admin can be granted/revoked */
  hasFullAccess: boolean;
  /** Department ID (for employees) */
  departmentId?: number;
  /** Team ID (for employees) */
  teamId?: number;
  /**
   * Expiration timestamp (Unix seconds) of the access token the caller
   * authenticated with. Propagated from the JWT payload by JwtAuthGuard so
   * downstream services (e.g. role-switch) can preserve the session lifetime
   * when minting a new token for a claim-only change — otherwise every
   * role-switch would issue a fresh 30-min token, which is (a) a silent
   * inactivity-timeout bypass (users click role-switch periodically to
   * extend the session indefinitely) and (b) visually jarring (header
   * countdown jumps back to 30:00 on every switch).
   */
  exp: number;
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
