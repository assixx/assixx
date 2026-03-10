/**
 * Reports Permission Definition (ADR-020)
 *
 * All report endpoints are admin-only (class-level @Roles).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const REPORTS_PERMISSIONS: PermissionCategoryDef = {
  code: 'reports',
  label: 'Berichte & Auswertungen',
  icon: 'fa-chart-line',
  modules: [
    {
      code: 'reports-view',
      label: 'Berichte einsehen',
      icon: 'fa-chart-bar',
      allowedPermissions: ['canRead'],
    },
    {
      code: 'reports-export',
      label: 'Berichte exportieren',
      icon: 'fa-file-export',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
