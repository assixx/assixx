/**
 * JWT Authentication Guard
 *
 * Validates JWT tokens and attaches user data to requests.
 * Supports \@Public() decorator for bypassing authentication.
 * Sets user context in CLS for downstream services.
 */
import { USER_ROLES } from '@assixx/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';

import { DatabaseService } from '../../database/database.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { JwtPayload, NestAuthUser, UserRole } from '../interfaces/auth.interface.js';
// ADR-050 cross-tenant host check — the middleware (global, mounted in
// app.module.ts `configure()`) populates `req.hostTenantId`; this guard
// enforces it must match the JWT's tenantId.
import type { HostAwareRequest } from '../middleware/tenant-host-resolver.middleware.js';

/**
 * Database row type for user lookup
 * Note: department_id is NOT in the users table - it's linked via user_departments
 */
interface UserRow {
  id: number;
  email: string;
  role: string;
  tenant_id: number;
  first_name: string | null;
  last_name: string | null;
  is_active: number;
  has_full_access: boolean;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (token === undefined || token === '') {
      throw new UnauthorizedException('No authentication token provided');
    }

    return await this.validateTokenAndSetContext(token, request);
  }

  /**
   * Validate JWT token and set user context
   */
  private async validateTokenAndSetContext(
    token: string,
    request: FastifyRequest,
  ): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      this.validateTokenType(payload);
      const user = await this.validateAndGetUser(payload);
      const authUser = this.buildAuthUser(user, payload);

      // Attach to request (use unknown to avoid type intersection with existing AuthUser)
      (request as unknown as { user: NestAuthUser }).user = authUser;

      // Set CLS context for downstream services
      this.cls.set('tenantId', authUser.tenantId);
      this.cls.set('userId', authUser.id);
      this.cls.set('userRole', authUser.activeRole);
      this.cls.set('userEmail', authUser.email);

      // ADR-050 cross-tenant host check — the load-bearing line of the
      // whole subdomain-routing design. `req.hostTenantId` was set by
      // `TenantHostResolverMiddleware` before this guard ran. Three-state
      // semantics:
      //
      //   undefined → middleware did not run (test fixture) — skip
      //   null      → apex / localhost / IP / unknown slug — skip
      //   number    → subdomain resolved — MUST match JWT's tenantId
      //
      // A JWT minted for tenant A sent to `tenant-b.assixx.com` hits the
      // `number` case with mismatch and throws 403. The discriminable
      // error code (`CROSS_TENANT_HOST_MISMATCH`) is Loki-alertable; it
      // is distinct from `HANDOFF_HOST_MISMATCH` (OAuth-flow-specific
      // per ADR-050 §R15) so attacks on the two surfaces can be told
      // apart in monitoring.
      //
      // @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check"
      // @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.3
      // Read `hostTenantId` via `request.raw` — under the NestJS+Fastify adapter,
      // class-based middleware (our TenantHostResolverMiddleware) runs through
      // `@fastify/middie`, which hands the middleware the RAW IncomingMessage.
      // That raw object is later exposed on FastifyRequest as `.raw`. Writing
      // to `request.hostTenantId` directly here would silently read undefined
      // on every request — turning this cross-check into a no-op. Discovered
      // Session 10 via API integration test (masterplan Phase 4 D17).
      const hostTenantId = (request as HostAwareRequest).raw.hostTenantId;
      if (
        hostTenantId !== undefined &&
        hostTenantId !== null &&
        hostTenantId !== authUser.tenantId
      ) {
        throw new ForbiddenException({
          code: 'CROSS_TENANT_HOST_MISMATCH',
          message: 'Token tenant does not match request host.',
        });
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // ADR-050 cross-tenant host mismatch must propagate with its
      // original 403 + discriminable code (`CROSS_TENANT_HOST_MISMATCH`).
      // Without this pass-through the generic catch below would mask it
      // as a generic 401 and destroy the monitoring signal.
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.warn('JWT verification failed', { error: String(error) });
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Validate token type is 'access'
   */
  private validateTokenType(payload: JwtPayload): void {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
  }

  /**
   * Validate user exists and is active
   */
  private async validateAndGetUser(payload: JwtPayload): Promise<UserRow> {
    const user = await this.lookupUser(payload.id, payload.tenantId);

    if (user === null) {
      throw new UnauthorizedException('User not found');
    }

    if (user.is_active !== 1) {
      throw new UnauthorizedException('User account is inactive');
    }

    const role = user.role as UserRole;
    if (!USER_ROLES.includes(role)) {
      throw new UnauthorizedException('Invalid user role');
    }

    return user;
  }

  /**
   * Build authenticated user object
   */
  private buildAuthUser(user: UserRow, payload: JwtPayload): NestAuthUser {
    const role = user.role as UserRole;
    const activeRole = payload.activeRole ?? role;

    if (!USER_ROLES.includes(activeRole)) {
      throw new UnauthorizedException('Invalid active role');
    }

    return {
      id: user.id,
      email: user.email,
      role,
      activeRole,
      isRoleSwitched: payload.isRoleSwitched ?? false,
      hasFullAccess: user.has_full_access,
      tenantId: user.tenant_id,
      // Propagate JWT exp for downstream session-lifetime preservation
      // (see NestAuthUser.exp doc + role-switch.service preserveExp).
      exp: payload.exp,
      ...(user.first_name !== null && { firstName: user.first_name }),
      ...(user.last_name !== null && { lastName: user.last_name }),
    };
  }

  /**
   * Extract JWT token from request
   * Checks: Authorization header, cookies, query parameter
   */
  private extractToken(request: FastifyRequest): string | undefined {
    // 1. Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader !== undefined) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token !== undefined) {
        return token;
      }
    }

    // 2. Cookie (via @fastify/cookie)
    const cookies = request.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.['accessToken'];
    if (cookieToken !== undefined) {
      return cookieToken;
    }

    // 3. Query parameter (for WebSocket connections)
    const query = request.query as Record<string, string | undefined>;
    const queryToken = query['token'];
    if (queryToken !== undefined) {
      return queryToken;
    }

    return undefined;
  }

  /**
   * Lookup user in database (fresh data, not from token)
   */
  private async lookupUser(userId: number, tenantId: number): Promise<UserRow | null> {
    const rows = await this.databaseService.queryAsTenant<UserRow>(
      `SELECT id, email, role, tenant_id, first_name, last_name, is_active, has_full_access
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
      tenantId,
    );

    return rows[0] ?? null;
  }
}
