/**
 * Halls Permission Definition (ADR-020)
 *
 * Covers admin-level hall management.
 * GET endpoints remain open (org structure is public for all users).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const HALLS_PERMISSIONS: PermissionCategoryDef = {
  code: 'halls',
  label: 'Hallen',
  icon: 'fa-warehouse',
  modules: [
    {
      code: 'halls-manage',
      label: 'Hallen verwalten',
      icon: 'fa-warehouse',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
  ],
};
