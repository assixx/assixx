/**
 * User Role Types
 *
 * System authentication roles (stored in DB).
 * ExtendedUserRole adds domain-specific roles for shift management.
 */

/** Core system authentication roles (DB column: role) */
export type UserRole = 'root' | 'admin' | 'employee';

/** Extended roles for domain-specific features (e.g., shift management UI) */
export type ExtendedUserRole = UserRole | 'team_lead' | 'manager';

/** Valid system roles as a readonly array (for validation) */
export const USER_ROLES = [
  'root',
  'admin',
  'employee',
] as const satisfies readonly UserRole[];

/** Extended roles array including domain-specific roles */
export const EXTENDED_USER_ROLES = [
  'root',
  'admin',
  'employee',
  'team_lead',
  'manager',
] as const satisfies readonly ExtendedUserRole[];
