/**
 * Sentry Instrumentation
 *
 * IMPORTANT: This file MUST be imported BEFORE any other modules!
 * It initializes Sentry's error tracking and performance monitoring.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nestjs/
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Sentry SDK convention
import * as Sentry from '@sentry/nestjs';

/**
 * Get environment-aware configuration
 */
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Sentry DSN from environment
 * Set SENTRY_DSN in .env or Docker environment
 */
const sentryDsn = process.env['SENTRY_DSN'];

/**
 * Only initialize Sentry if DSN is configured
 * This allows running without Sentry in local development
 */
if (sentryDsn !== undefined && sentryDsn !== '') {
  Sentry.init({
    dsn: sentryDsn,

    // Environment identification
    environment: process.env['NODE_ENV'] ?? 'development',

    // Release tracking (set via CI/CD or build process)
    release:
      process.env['SENTRY_RELEASE'] ??
      `assixx-backend@${process.env['npm_package_version'] ?? 'unknown'}`,

    // Performance Monitoring
    // Capture 100% of transactions in development, 10% in production
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Profiling (optional, helps identify slow code)
    // Relative to tracesSampleRate
    profilesSampleRate: isProduction ? 0.1 : 1.0,

    // Send default PII (user data) - careful with GDPR
    // Only enable if you need user context in errors
    sendDefaultPii: false,

    // Debug mode - explicitly opt-in to avoid log spam
    // Set SENTRY_DEBUG=true only when debugging Sentry integration
    debug: process.env['SENTRY_DEBUG'] === 'true',

    // Integrations configuration
    integrations: [
      // Add any custom integrations here
    ],

    // Before send hook - can modify or drop events
    beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
      // Don't send events in test environment
      if (process.env['NODE_ENV'] === 'test') {
        return null;
      }

      // Filter out expected errors (optional)
      // Don't report 404s or validation errors
      const error = hint.originalException;
      if (
        error instanceof Error &&
        (error.message.includes('Not Found') || error.message.includes('Validation'))
      ) {
        return null;
      }

      return event;
    },

    // Ignore specific error types
    ignoreErrors: [
      // Common network errors that aren't actionable
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // Add project-specific errors to ignore
    ],
  });

  // Log successful initialization
  // Using console here because logger might not be initialized yet
  console.log(`[Sentry] Initialized for environment: ${process.env['NODE_ENV'] ?? 'development'}`);
} else {
  console.log('[Sentry] DSN not configured - Sentry disabled');
}

export { Sentry };
