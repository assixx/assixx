/**
 * Teams Permission Definition (ADR-020)
 *
 * Covers admin-level team management (CRUD, member/asset assignment).
 * GET endpoints remain open (org structure is public for all users).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const TEAMS_PERMISSIONS: PermissionCategoryDef = {
  code: 'teams',
  label: 'Teams',
  icon: 'fa-people-group',
  modules: [
    {
      code: 'teams-manage',
      label: 'Teams verwalten',
      icon: 'fa-people-group',
      allowedPermissions: ['canWrite', 'canDelete'],
    },
  ],
};
