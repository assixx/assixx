/**
 * Role Constants
 *
 * Labels and display helpers for user roles.
 */
import type { ExtendedUserRole, UserRole } from '../types/user-role.js';

/** German labels for system roles */
export const ROLE_LABELS: Record<UserRole, string> = {
  root: 'Root',
  admin: 'Administrator',
  employee: 'Mitarbeiter',
  dummy: 'Dummy',
};

/** German labels for extended roles (includes domain-specific) */
export const EXTENDED_ROLE_LABELS: Record<ExtendedUserRole, string> = {
  root: 'Root',
  admin: 'Administrator',
  employee: 'Mitarbeiter',
  dummy: 'Dummy',
  team_lead: 'Teamleiter',
  manager: 'Manager',
};
