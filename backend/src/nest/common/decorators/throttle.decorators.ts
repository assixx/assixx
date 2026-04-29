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
 *
 * Bug fix (2026-04-19, live smoke-test discovery): after Plan 2 §2.7 added the
 * `domain-verify` tier (10/10min) to `AppThrottlerModule`, every non-domain-verify
 * decorator in this file silently DID NOT skip it — so every authenticated
 * endpoint ALSO counted against the tight 10/10min bucket and 429'd after 10
 * requests. The SkipThrottle lists below now include `'domain-verify': true`
 * everywhere for tier isolation. Rule for future tiers: when adding a new
 * throttler to `AppThrottlerModule`, audit EVERY decorator here and add it to
 * the SkipThrottle list unless you explicitly want cross-tier counting.
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
 * Skips: public, user, admin, upload, export, domain-verify, 2fa-verify, 2fa-resend throttlers
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
      'domain-verify': true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * User endpoints: 1000 requests per 15 minutes
 * Use for: standard authenticated endpoints
 * Skips: auth, public, admin, upload, export, domain-verify, 2fa-verify, 2fa-resend throttlers
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
      'domain-verify': true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * Admin endpoints: 2000 requests per 15 minutes
 * Use for: admin dashboard, bulk operations
 * Skips: auth, public, user, upload, export, domain-verify, 2fa-verify, 2fa-resend throttlers
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
      'domain-verify': true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * Export endpoints: 1 request per minute
 * Use for: audit log export, bulk data export
 * Prevents DoS via large export operations
 * Skips: auth, public, user, admin, upload, domain-verify, 2fa-verify, 2fa-resend throttlers
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
      'domain-verify': true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * Domain-Verify endpoint: 10 requests per 10 minutes.
 * Use for: `POST /domains/:id/verify` — the only endpoint that emits outbound
 * DNS (TXT-record lookup). Tight cap protects upstream resolvers and defends
 * R11 (Docker bridge DNS exhaustion). Tier registered in `AppThrottlerModule`.
 * Masterplan §2.7, ADR-048.
 * Skips: auth, public, user, admin, upload, export, 2fa-verify, 2fa-resend throttlers.
 */
export const DomainVerifyThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ 'domain-verify': { limit: 10, ttl: 10 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * Feedback endpoints: 5 requests per hour.
 * Use for: bug reports, feature requests — every submission triggers an
 * outbound email, so flooding would hurt deliverability AND spam the ops
 * inbox. 5/h is generous for genuine users and restrictive enough that a
 * malicious authenticated client can't DoS the inbox.
 * Overrides the `user` tier (which exists in module config) so the limit
 * actually takes effect; all other tiers are skipped for isolation.
 */
export const FeedbackThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ user: { limit: 5, ttl: 60 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * 2FA verify endpoint: 5 requests per 10 minutes per challenge token.
 * Use for: `POST /auth/2fa/verify` (Step 2.7).
 *
 * v0.5.0 P2-Fix (masterplan §2.8): keyed on `challengeToken` cookie via the
 * tier's `getTracker` in `throttler.module.ts`, so industrial customers
 * behind one NAT egress (50–500 users) are not blocked by their colleagues
 * during shift-change login waves. Service-layer caps (`record.attemptCount`,
 * `2fa:fail-streak:{userId}`) are the brute-force defence; this tier is
 * anti-spam, not anti-brute-force.
 * Skips: auth, public, user, admin, upload, export, domain-verify, 2fa-resend throttlers.
 */
export const TwoFaVerifyThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-verify': { limit: 5, ttl: 10 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-resend': true,
    }),
  );

/**
 * 2FA resend endpoint: 1 request per 60 s per challenge token.
 * Use for: `POST /auth/2fa/resend` (Step 2.7).
 *
 * Same NAT-fairness rationale as TwoFaVerifyThrottle. The 60 s window aligns
 * with the user-facing resend cooldown (DD-9, `RESEND_COOLDOWN_SEC`) so the
 * throttler and the service-layer cap converge on the same UX ("wait 60 s")
 * instead of producing two divergent 429 paths.
 * Skips: auth, public, user, admin, upload, export, domain-verify, 2fa-verify throttlers.
 */
export const TwoFaResendThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-resend': { limit: 1, ttl: MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-verify': true,
    }),
  );
