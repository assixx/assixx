/**
 * Current User Decorator
 *
 * Extracts the authenticated user from the request.
 * Provides type-safe access to user data in controllers.
 */
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { NestAuthUser } from '../interfaces/auth.interface.js';

/**
 * Get the current authenticated user from request
 *
 * @param data - Optional property to extract from user
 * @returns The user object or specific property
 *
 * @example
 * ```typescript
 * // Get entire user object
 * \@Get('profile')
 * getProfile(\@CurrentUser() user: NestAuthUser) {
 *   return user;
 * }
 *
 * // Get specific property
 * \@Get('tenant')
 * getTenant(\@CurrentUser('tenantId') tenantId: number) {
 *   return { tenantId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof NestAuthUser | undefined,
    ctx: ExecutionContext,
  ): NestAuthUser | NestAuthUser[keyof NestAuthUser] => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user: NestAuthUser }>();
    const user = request.user;

    if (data !== undefined) {
      return user[data];
    }

    return user;
  },
);
