/**
 * Calendar Permission Definitions
 *
 * Defines which permission modules the calendar addon exposes.
 * Registered via CalendarPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const CALENDAR_PERMISSIONS: PermissionCategoryDef = {
  code: 'calendar',
  label: 'Kalender',
  icon: 'fa-calendar',
  modules: [
    {
      code: 'calendar-events',
      label: 'Termine',
      icon: 'fa-calendar-day',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
