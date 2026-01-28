/**
 * Public Route Decorator
 *
 * Marks a route as public (no authentication required).
 * Used to bypass JwtAuthGuard for specific endpoints.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (no authentication required)
 *
 * @example
 * ```typescript
 * \@Public()
 * \@Get('health')
 * getHealth() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IS_PUBLIC_KEY, true);
