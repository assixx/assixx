/**
 * Shift Planning Permission Definitions
 *
 * Defines which permission modules the shift planning addon exposes.
 * Registered via ShiftsPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const SHIFTS_PERMISSIONS: PermissionCategoryDef = {
  code: 'shift_planning',
  label: 'Schichtplanung',
  icon: 'fa-calendar-alt',
  modules: [
    {
      code: 'shift-plan',
      label: 'Schichtplan',
      icon: 'fa-calendar-alt',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'shift-swap',
      label: 'Tauschbörse',
      icon: 'fa-exchange-alt',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'shift-rotation',
      label: 'Rotation',
      icon: 'fa-sync-alt',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'shift-times',
      label: 'Schichtzeiten',
      icon: 'fa-clock',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
