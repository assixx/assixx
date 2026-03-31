/**
 * User Profiles Permission Definition (ADR-020)
 *
 * Defines the permission category for viewing other users' profiles.
 * Registered automatically via UsersPermissionRegistrar on module init.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const USER_PROFILES_PERMISSIONS: PermissionCategoryDef = {
  code: 'user_profiles',
  label: 'Benutzerprofile',
  icon: 'fa-id-card',
  modules: [
    {
      code: 'user-profiles-view',
      label: 'Profile ansehen',
      icon: 'fa-eye',
      allowedPermissions: ['canRead'],
    },
  ],
};
