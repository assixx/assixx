/**
 * Departments Permission Definition (ADR-020)
 *
 * Covers admin-level department and area management.
 * GET endpoints remain open (org structure is public for all users).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const DEPARTMENTS_PERMISSIONS: PermissionCategoryDef = {
  code: 'departments',
  label: 'Abteilungen & Bereiche',
  icon: 'fa-building',
  modules: [
    {
      code: 'departments-manage',
      label: 'Abteilungen verwalten',
      icon: 'fa-building',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
    {
      code: 'areas-manage',
      label: 'Bereiche verwalten',
      icon: 'fa-map',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
  ],
};
