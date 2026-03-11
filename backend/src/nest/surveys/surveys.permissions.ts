/**
 * Surveys Permission Definitions
 *
 * Defines which permission modules the surveys addon exposes.
 * Registered via SurveysPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const SURVEYS_PERMISSIONS: PermissionCategoryDef = {
  code: 'surveys',
  label: 'Umfragen',
  icon: 'fa-poll',
  modules: [
    {
      code: 'surveys-manage',
      label: 'Verwaltung',
      icon: 'fa-poll',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'surveys-participate',
      label: 'Teilnahme',
      icon: 'fa-clipboard-check',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'surveys-results',
      label: 'Ergebnisse',
      icon: 'fa-chart-bar',
      allowedPermissions: ['canRead'],
    },
  ],
};
