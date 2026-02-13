/**
 * Vacation Permission Definition (ADR-020)
 *
 * Defines the permission category and modules for the vacation feature.
 * Registered automatically via VacationPermissionRegistrar on module init.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const VACATION_PERMISSIONS: PermissionCategoryDef = {
  code: 'vacation',
  label: 'Urlaubsverwaltung',
  icon: 'fa-umbrella-beach',
  modules: [
    {
      code: 'vacation-requests',
      label: 'UrlaubsAnträge',
      icon: 'fa-file-alt',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'vacation-rules',
      label: 'Regeln & Sperren',
      icon: 'fa-ban',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'vacation-entitlements',
      label: 'Urlaubsansprüche',
      icon: 'fa-calculator',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'vacation-holidays',
      label: 'Feiertage',
      icon: 'fa-calendar-day',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'vacation-overview',
      label: 'Uebersicht & Kalender',
      icon: 'fa-chart-bar',
      allowedPermissions: ['canRead'],
    },
  ],
};
