/**
 * Roles Decorator
 *
 * Defines required roles for accessing a route.
 * Used with RolesGuard to implement RBAC.
 */
import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../interfaces/auth.interface.js';

export const ROLES_KEY = 'roles';

/**
 * Require specific roles for route access
 *
 * @param roles - Array of allowed roles
 *
 * @example
 * ```typescript
 * \@Roles('admin', 'root')
 * \@Get('admin-only')
 * getAdminData() {
 *   return { secret: 'data' };
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
