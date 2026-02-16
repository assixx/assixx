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
 *   - hasFullAccess=true → always pass (root by DB trigger, admin by grant)
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

    // Users with hasFullAccess always bypass permission checks.
    // Root users always have has_full_access=true in DB (enforced by trigger).
    // Admin users may have it granted individually.
    // This check uses the DB source of truth, not activeRole, so it works
    // correctly even when role-switched (e.g. root viewing as employee).
    if (user.hasFullAccess) {
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
