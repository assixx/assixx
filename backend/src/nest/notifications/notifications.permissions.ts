/**
 * Notifications Permission Definition (ADR-020)
 *
 * Most notification endpoints are self-service (read own, mark read, delete own).
 * Admin-only: creating notifications, viewing statistics.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const NOTIFICATIONS_PERMISSIONS: PermissionCategoryDef = {
  code: 'notifications',
  label: 'Benachrichtigungen',
  icon: 'fa-bell',
  modules: [
    {
      code: 'notifications-manage',
      label: 'Benachrichtigungen verwalten',
      icon: 'fa-bell',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
