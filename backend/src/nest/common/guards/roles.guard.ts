/**
 * Roles Guard
 *
 * Role-based access control guard.
 * Checks if the authenticated user has the required role.
 * Uses \@Roles() decorator to define required roles.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { NestAuthUser, UserRole } from '../interfaces/auth.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required = public access (but still needs authentication via JwtAuthGuard)
    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const user = request.user;

    if (user === undefined) {
      throw new ForbiddenException('User not authenticated');
    }

    // Use activeRole for role-switched users
    const effectiveRole = user.activeRole;

    if (!requiredRoles.includes(effectiveRole)) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${effectiveRole}`,
      );
    }

    return true;
  }
}
