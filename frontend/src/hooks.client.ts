/**
 * SvelteKit Client Hooks - Sentry Error Tracking
 *
 * Initializes Sentry on the client side for browser error tracking.
 * Replay + Feedback are lazy-loaded to reduce initial bundle (~500 KiB savings on login).
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

// Public pages where Replay/Feedback are unnecessary (no authenticated user session)
const isPublicPage =
  typeof window !== 'undefined' &&
  ['/login', '/signup', '/'].some((p) => window.location.pathname === p);

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

  // Session Replay — disabled on public pages (login, signup, landing)
  // Saves ~500 KiB unused JS on first page load
  replaysSessionSampleRate: dev || isPublicPage ? 0 : 0.1,
  replaysOnErrorSampleRate: isPublicPage ? 0 : 1.0,

  // Integrations
  // Dev: BrowserTracing patches window.fetch + history.pushState which triggers
  // SvelteKit dev-mode warnings. Since tracesSampleRate: 0 in dev, tracing
  // collects nothing anyway — remove the integration to avoid noise.
  // Public pages: skip Replay integration entirely (~500 KiB bundle reduction)
  integrations: (defaultIntegrations) => {
    const base =
      dev ? defaultIntegrations.filter((i) => i.name !== 'BrowserTracing') : defaultIntegrations;

    // On public pages, don't load Replay at all — core error tracking only
    if (isPublicPage) {
      return base;
    }

    return [
      ...base,
      Sentry.replayIntegration({
        // Privacy: mask text and block media in production
        // Dev: relaxed for easier debugging
        maskAllText: !dev,
        blockAllMedia: !dev,
      }),
    ];
  },
});

if (dev) {
  log.info(`Frontend client initialized (replay: ${isPublicPage ? 'off' : 'on'})`);
}

/**
 * Client-side error handler
 * Wraps the default error handler with Sentry error capture
 */
export const handleError = Sentry.handleErrorWithSentry();
