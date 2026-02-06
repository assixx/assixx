/**
 * Tenant Decorator
 *
 * Extracts the tenant ID from the authenticated user.
 * Convenience decorator for multi-tenant operations.
 */
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { NestAuthUser } from '../interfaces/auth.interface.js';

/**
 * Get the current tenant ID from authenticated user
 *
 * @example
 * ```typescript
 * \@Get('data')
 * getData(\@TenantId() tenantId: number) {
 *   return this.service.getDataForTenant(tenantId);
 * }
 * ```
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user: NestAuthUser }>();
    return request.user.tenantId;
  },
);
