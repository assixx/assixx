/**
 * Assets Permission Definition (ADR-020)
 *
 * Covers admin-level asset management endpoints.
 * Read endpoints (list, get, statistics, categories) are open to all authenticated users.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const ASSETS_PERMISSIONS: PermissionCategoryDef = {
  code: 'assets',
  label: 'Anlagen & Maschinen',
  icon: 'fa-industry',
  modules: [
    {
      code: 'assets-manage',
      label: 'Anlagen verwalten',
      icon: 'fa-cog',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
    {
      code: 'assets-availability',
      label: 'Verfügbarkeit',
      icon: 'fa-clock',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
  ],
};
