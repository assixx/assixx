/**
 * Permission Guard
 *
 * Per-user feature permission enforcement.
 * Reads \@RequirePermission() decorator metadata and checks
 * user_feature_permissions table via UserPermissionsService.
 *
 * Guard execution order (all global):
 *   1. JwtAuthGuard — authenticates, attaches user to request
 *   2. RolesGuard — checks user role against \@Roles()
 *   3. PermissionGuard — checks feature permission against \@RequirePermission()
 *
 * Bypass rules:
 *   - No \@RequirePermission() metadata → pass through
 *   - Root user → always pass (full access by design)
 *   - Admin with hasFullAccess → always pass
 *   - All others → DB lookup, fail-closed (no row = denied)
 *
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { UserPermissionsService } from '../../user-permissions/user-permissions.service.js';
import type { RequiredPermission } from '../decorators/require-permission.decorator.js';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: UserPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    // No permission decorator on this endpoint → pass through
    if (required === undefined) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const user = request.user;

    if (user === undefined) {
      throw new ForbiddenException('User not authenticated');
    }

    // Root always has full access — enforced by DB trigger + design
    if (user.activeRole === 'root') {
      return true;
    }

    // Admin with full access bypasses permission checks
    if (user.activeRole === 'admin' && user.hasFullAccess) {
      return true;
    }

    // Check permission in DB (fail-closed: no row = denied)
    const granted = await this.permissionService.hasPermission(
      user.id,
      required.featureCode,
      required.moduleCode,
      required.action,
    );

    if (!granted) {
      this.logger.warn(
        `Permission denied: user ${user.id} (${user.activeRole}) lacks ${required.action} for ${required.featureCode}/${required.moduleCode}`,
      );
      throw new ForbiddenException(
        `Permission denied: ${required.action} access required for ${required.featureCode}/${required.moduleCode}`,
      );
    }

    return true;
  }
}
