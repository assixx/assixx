/**
 * Require Permission Decorator
 *
 * Defines required addon permission for accessing a route.
 * Used with PermissionGuard to implement per-user addon permission control.
 * Works alongside \@Roles() — roles are checked first, then permissions.
 *
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import { SetMetadata } from '@nestjs/common';

import type { PermissionType } from '../permission-registry/permission.types.js';

export const PERMISSION_KEY = 'requiredPermission';

/** Metadata shape stored by the decorator */
export interface RequiredPermission {
  addonCode: string;
  moduleCode: string;
  action: PermissionType;
}

/**
 * Require a specific addon permission for route access.
 * PermissionGuard reads this metadata and checks user_addon_permissions table.
 *
 * Root and admin-with-full-access bypass this check automatically.
 * All other users must have an explicit grant in the DB.
 *
 * @param addonCode - Addon code (e.g. 'blackboard')
 * @param moduleCode - Module code within the addon (e.g. 'blackboard-posts')
 * @param action - Permission type required ('canRead' | 'canWrite' | 'canDelete')
 *
 * @example
 * ```typescript
 * @RequirePermission('blackboard', 'blackboard-posts', 'canRead')
 * @Get('entries')
 * listEntries() { ... }
 * ```
 */
export const RequirePermission = (
  addonCode: string,
  moduleCode: string,
  action: PermissionType,
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSION_KEY, { addonCode, moduleCode, action });
