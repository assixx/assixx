/**
 * Tenant Addon Guard
 *
 * Global guard (APP_GUARD) that checks whether the tenant has an active
 * addon subscription before allowing access to the controller.
 *
 * Execution order: JwtAuthGuard → RolesGuard → TenantAddonGuard → PermissionGuard
 *
 * Uses the `@RequireAddon('code')` decorator on controllers.
 * If no decorator is present, the guard passes through (core endpoints).
 *
 * Unlike PermissionGuard (user-level), this checks TENANT-level activation
 * in the `addons` / `tenant_addons` tables. No root/admin bypass — addon
 * activation is a business/billing decision, not a role privilege.
 *
 * @see AddonCheckService.checkTenantAccess
 * @see REQUIRE_ADDON_KEY
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

import { AddonCheckService } from '../../addon-check/addon-check.service.js';
import { REQUIRE_ADDON_KEY } from '../decorators/require-addon.decorator.js';

/** Minimal user shape — only tenantId is needed for this guard */
interface TenantUser {
  tenantId: number;
}

@Injectable()
export class TenantAddonGuard implements CanActivate {
  private readonly logger = new Logger(TenantAddonGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly addonCheck: AddonCheckService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read class-level @RequireAddon() metadata (method-level override supported)
    const addonCode = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_ADDON_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequireAddon decorator → pass through (core endpoints, auth, health, etc.)
    if (addonCode === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: TenantUser }>();
    const user = request.user;

    if (user?.tenantId === undefined) {
      this.logger.warn(`TenantAddonGuard: no user/tenantId on request for addon "${addonCode}"`);
      throw new ForbiddenException('No tenant context available');
    }

    const hasAccess = await this.addonCheck.checkTenantAccess(user.tenantId, addonCode);

    if (!hasAccess) {
      this.logger.warn(`Tenant ${user.tenantId} does not have addon "${addonCode}" enabled`);
      throw new ForbiddenException(`${addonCode} addon is not enabled for this tenant`);
    }

    return true;
  }
}
