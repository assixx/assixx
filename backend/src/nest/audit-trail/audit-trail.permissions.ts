/**
 * Audit Trail Permission Definition (ADR-020)
 *
 * GET /audit-trail and GET /audit-trail/:id are open to all authenticated users.
 * Admin/root-only: stats, report generation, export, retention.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const AUDIT_TRAIL_PERMISSIONS: PermissionCategoryDef = {
  code: 'audit_trail',
  label: 'Protokoll & Audit',
  icon: 'fa-history',
  modules: [
    {
      code: 'audit-view',
      label: 'Statistiken einsehen',
      icon: 'fa-chart-pie',
      allowedPermissions: ['canRead'],
    },
    {
      code: 'audit-export',
      label: 'Berichte & Export',
      icon: 'fa-file-export',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'audit-retention',
      label: 'Aufbewahrung verwalten',
      icon: 'fa-trash-alt',
      allowedPermissions: ['canRead', 'canDelete'],
    },
  ],
};
