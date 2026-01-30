/**
 * Base Auth User
 *
 * Shared fields between frontend and backend authenticated user objects.
 * Each side extends this with their own additional fields.
 *
 * Backend (NestAuthUser) adds: activeRole, isRoleSwitched, departmentId, teamId
 * Frontend (LocalsUser) adds: hasFullAccess
 */
import type { UserRole } from './user-role.js';

/** Base authenticated user - shared between frontend and backend */
export interface BaseAuthUser {
  /** User ID */
  id: number;
  /** User email */
  email: string;
  /** User role from database */
  role: UserRole;
  /** Tenant ID for multi-tenant isolation */
  tenantId: number;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
}
