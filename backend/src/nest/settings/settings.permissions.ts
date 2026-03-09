/**
 * Settings Permission Definition (ADR-020)
 *
 * Covers admin-level tenant settings management.
 * System settings remain root-only. User settings are self-service.
 * GET endpoints remain open (employees read tenant settings for UI).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const SETTINGS_PERMISSIONS: PermissionCategoryDef = {
  code: 'settings',
  label: 'Einstellungen',
  icon: 'fa-cog',
  modules: [
    {
      code: 'settings-tenant',
      label: 'Mandanten-Einstellungen',
      icon: 'fa-sliders-h',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
  ],
};
