/**
 * Tenant Context Interceptor
 *
 * Sets tenant context in CLS after authentication.
 * Ensures tenant isolation for all database operations.
 */
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

import type { NestAuthUser } from '../interfaces/auth.interface.js';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const user = request.user;

    if (user !== undefined) {
      // Set tenant context for database operations
      this.cls.set('tenantId', user.tenantId);
      this.cls.set('userId', user.id);
      this.cls.set('userRole', user.activeRole);
      this.cls.set('userEmail', user.email);

      this.logger.debug(
        `Tenant context set: tenantId=${user.tenantId}, userId=${user.id}, role=${user.activeRole}`,
      );
    }

    return next.handle();
  }
}
