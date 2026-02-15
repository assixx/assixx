/**
 * Tenant Feature Guard
 *
 * Global guard (APP_GUARD) that checks whether the tenant has an active
 * feature subscription before allowing access to the controller.
 *
 * Execution order: JwtAuthGuard → RolesGuard → TenantFeatureGuard → PermissionGuard
 *
 * Uses the `\@TenantFeature('code')` decorator on controllers.
 * If no decorator is present, the guard passes through (core endpoints).
 *
 * Unlike PermissionGuard (user-level), this checks TENANT-level activation
 * in the `tenant_features` table. No root/admin bypass — feature activation
 * is a business/billing decision, not a role privilege.
 *
 * @see FeatureCheckService.checkTenantAccess
 * @see TENANT_FEATURE_KEY
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

import { FeatureCheckService } from '../../feature-check/feature-check.service.js';
import { TENANT_FEATURE_KEY } from '../decorators/tenant-feature.decorator.js';

/** Minimal user shape — only tenantId is needed for this guard */
interface TenantUser {
  tenantId: number;
}

@Injectable()
export class TenantFeatureGuard implements CanActivate {
  private readonly logger = new Logger(TenantFeatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureCheck: FeatureCheckService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read class-level @TenantFeature() metadata (method-level override supported)
    const featureCode = this.reflector.getAllAndOverride<string | undefined>(
      TENANT_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @TenantFeature decorator → pass through (core endpoints, auth, health, etc.)
    if (featureCode === undefined) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: TenantUser }>();
    const user = request.user;

    if (user?.tenantId === undefined) {
      this.logger.warn(
        `TenantFeatureGuard: no user/tenantId on request for feature "${featureCode}"`,
      );
      throw new ForbiddenException('No tenant context available');
    }

    const hasAccess = await this.featureCheck.checkTenantAccess(
      user.tenantId,
      featureCode,
    );

    if (!hasAccess) {
      this.logger.warn(
        `Tenant ${user.tenantId} does not have feature "${featureCode}" enabled`,
      );
      throw new ForbiddenException(
        `${featureCode} feature is not enabled for this tenant`,
      );
    }

    return true;
  }
}
