/**
 * Blackboard Permission Definitions
 *
 * Defines which permission modules the blackboard feature exposes.
 * Registered via BlackboardPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const BLACKBOARD_PERMISSIONS: PermissionCategoryDef = {
  code: 'blackboard',
  label: 'Schwarzes Brett',
  icon: 'fa-clipboard',
  modules: [
    {
      code: 'blackboard-posts',
      label: 'Beiträge',
      icon: 'fa-sticky-note',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'blackboard-comments',
      label: 'Kommentare',
      icon: 'fa-comments',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'blackboard-archive',
      label: 'Archiv',
      icon: 'fa-archive',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
