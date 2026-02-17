/**
 * SvelteKit Client Hooks - Sentry Error Tracking
 *
 * Initializes Sentry on the client side for browser error tracking.
 *
 * Note: DSN is hardcoded because it's public (only allows event submission).
 * This also avoids TypeScript issues with $env/static/public during tsc checks.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
 * @see https://docs.sentry.io/concepts/key-terms/dsn-explainer/
 */
import * as Sentry from '@sentry/sveltekit';

import { dev } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

const log = createLogger('Sentry');

// DSN is public - hardcoding is the recommended approach per Sentry docs
// See: https://docs.sentry.io/concepts/key-terms/dsn-explainer/
const SENTRY_DSN =
  'https://afe0f8b38a0c3cc9c09d40f90743766a@o4510697769730048.ingest.de.sentry.io/4510697927802960';

Sentry.init({
  dsn: SENTRY_DSN,

  // Tunnel through our own server to bypass:
  // - Firefox Enhanced Tracking Protection
  // - Ad blockers
  // - Corporate firewalls
  // @see https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
  tunnel: '/sentry-tunnel',

  // Environment identification
  environment: dev ? 'development' : 'production',

  // Performance Monitoring
  // Dev: disabled (noisy, data is useless locally)
  // Prod: 10% sample rate
  tracesSampleRate: dev ? 0 : 0.1,

  // Session Replay
  // Dev: buffer-only mode (records locally, uploads ONLY on error)
  //      → no /sentry-tunnel spam, but error context is preserved
  // Prod: 10% full session recording, 100% error-triggered replays
  // @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/session-replay/
  replaysSessionSampleRate: dev ? 0 : 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Privacy: mask text and block media in production
      // Dev: relaxed for easier debugging
      maskAllText: !dev,
      blockAllMedia: !dev,
    }),
  ],
});

if (dev) {
  log.info('Frontend client initialized');
}

/**
 * Client-side error handler
 * Wraps the default error handler with Sentry error capture
 */
export const handleError = Sentry.handleErrorWithSentry();
