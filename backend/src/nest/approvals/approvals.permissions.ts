/**
 * Approvals — Permission Category Definition (ADR-020)
 * @module approvals/approvals.permissions
 *
 * Core addon (is_core=true) — no AddonGuard needed.
 * Per-user permissions still apply via PermissionGuard.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const APPROVALS_PERMISSIONS: PermissionCategoryDef = {
  code: 'approvals',
  label: 'Freigaben',
  icon: 'fa-check-double',
  modules: [
    {
      code: 'approvals-manage',
      label: 'Freigaben verwalten',
      icon: 'fa-check-double',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'approvals-request',
      label: 'Freigaben anfordern',
      icon: 'fa-paper-plane',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
