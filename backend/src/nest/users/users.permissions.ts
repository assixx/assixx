/**
 * Users (Employees) Permission Definition (ADR-020)
 *
 * Covers admin-level user management endpoints.
 * Self-service endpoints (/me/*) are NOT permission-gated.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const USERS_PERMISSIONS: PermissionCategoryDef = {
  code: 'employees',
  label: 'Mitarbeiterverwaltung',
  icon: 'fa-users',
  modules: [
    {
      code: 'employees-manage',
      label: 'Benutzer verwalten',
      icon: 'fa-user-edit',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'employees-availability',
      label: 'Verfügbarkeit',
      icon: 'fa-user-clock',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
