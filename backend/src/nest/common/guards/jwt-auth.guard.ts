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

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
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
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, email, role, tenant_id, first_name, last_name, is_active, has_full_access
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  }
}
