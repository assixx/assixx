/**
 * Throttle Decorators
 *
 * Convenience decorators for applying rate limits to controllers and routes.
 * Each decorator corresponds to a tier defined in throttler.module.ts.
 *
 * Usage:
 *   - AuthThrottle()    - 5 requests per 15 minutes (login/signup)
 *   - PublicThrottle()  - 100 requests per 15 minutes (public pages)
 *   - UserThrottle()    - 1000 requests per 15 minutes (authenticated users)
 *   - AdminThrottle()   - 2000 requests per 15 minutes (admin endpoints)
 *   - UploadThrottle()  - 20 requests per hour (file uploads)
 *   - NoThrottle()      - Skip rate limiting (use sparingly!)
 */
import { SkipThrottle, Throttle } from '@nestjs/throttler';

/** Time constants in milliseconds */
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;

/** Return type for Throttle decorator factory */
type ThrottleDecorator = MethodDecorator & ClassDecorator;

/**
 * Auth endpoints: 5 requests per 15 minutes
 * Use for: login, signup, password reset
 */
export const AuthThrottle = (): ThrottleDecorator =>
  Throttle({ auth: { limit: 5, ttl: 15 * MS_MINUTE } });

/**
 * Public endpoints: 100 requests per 15 minutes
 * Use for: public pages, unauthenticated API calls
 */
export const PublicThrottle = (): ThrottleDecorator =>
  Throttle({ public: { limit: 100, ttl: 15 * MS_MINUTE } });

/**
 * User endpoints: 1000 requests per 15 minutes
 * Use for: standard authenticated endpoints
 */
export const UserThrottle = (): ThrottleDecorator =>
  Throttle({ user: { limit: 1000, ttl: 15 * MS_MINUTE } });

/**
 * Admin endpoints: 2000 requests per 15 minutes
 * Use for: admin dashboard, bulk operations
 */
export const AdminThrottle = (): ThrottleDecorator =>
  Throttle({ admin: { limit: 2000, ttl: 15 * MS_MINUTE } });

/**
 * Upload endpoints: 20 requests per hour
 * Use for: file uploads, document creation
 */
export const UploadThrottle = (): ThrottleDecorator =>
  Throttle({ upload: { limit: 20, ttl: MS_HOUR } });

/**
 * Export endpoints: 1 request per minute
 * Use for: audit log export, bulk data export
 * Prevents DoS via large export operations
 */
export const ExportThrottle = (): ThrottleDecorator =>
  Throttle({ export: { limit: 1, ttl: MS_MINUTE } });

/**
 * Skip rate limiting entirely
 * Use sparingly! Only for health checks, internal endpoints
 */
export const NoThrottle = (): ThrottleDecorator => SkipThrottle();
