/**
 * Throttle Decorators
 *
 * Convenience decorators for applying rate limits to controllers and routes.
 * Each decorator applies ONLY ONE throttler tier - all others are skipped.
 *
 * IMPORTANT: nestjs/throttler applies ALL defined throttlers by default.
 * These decorators use applyDecorators to combine Throttle + SkipThrottle
 * so only the intended tier is active.
 *
 * Usage:
 *   - AuthThrottle()    - 10 requests per 5 minutes (login/signup)
 *   - UserThrottle()    - 1000 requests per 15 minutes (authenticated users)
 *   - AdminThrottle()   - 2000 requests per 15 minutes (admin endpoints)
 *   - ExportThrottle()  - 1 request per minute (bulk exports)
 */
import { applyDecorators } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

/** Time constants in milliseconds */
const MS_MINUTE = 60_000;

/** Return type for Throttle decorator factory */
type ThrottleDecorator = MethodDecorator & ClassDecorator;

/**
 * Auth endpoints: 10 requests per 5 minutes
 * Use for: login, signup, password reset
 * Skips: public, user, admin, upload, export throttlers
 */
export const AuthThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ auth: { limit: 10, ttl: 5 * MS_MINUTE } }),
    SkipThrottle({
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
    }),
  ) as ThrottleDecorator;

/**
 * User endpoints: 1000 requests per 15 minutes
 * Use for: standard authenticated endpoints
 * Skips: auth, public, admin, upload, export throttlers
 */
export const UserThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ user: { limit: 1000, ttl: 15 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      admin: true,
      upload: true,
      export: true,
    }),
  ) as ThrottleDecorator;

/**
 * Admin endpoints: 2000 requests per 15 minutes
 * Use for: admin dashboard, bulk operations
 * Skips: auth, public, user, upload, export throttlers
 */
export const AdminThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ admin: { limit: 2000, ttl: 15 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      upload: true,
      export: true,
    }),
  ) as ThrottleDecorator;

/**
 * Export endpoints: 1 request per minute
 * Use for: audit log export, bulk data export
 * Prevents DoS via large export operations
 * Skips: auth, public, user, admin, upload throttlers
 */
export const ExportThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ export: { limit: 1, ttl: MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
    }),
  ) as ThrottleDecorator;
