/**
 * Dummy Users Permission Definition (ADR-020)
 *
 * All endpoints are admin-only (class-level @Roles).
 * Dummy users are anonymous display accounts for factory screens.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const DUMMY_USERS_PERMISSIONS: PermissionCategoryDef = {
  code: 'dummy_users',
  label: 'Platzhalter-Benutzer',
  icon: 'fa-user-slash',
  modules: [
    {
      code: 'dummy-users-manage',
      label: 'Platzhalter verwalten',
      icon: 'fa-user-slash',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
