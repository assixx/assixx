/**
 * SvelteKit Server Instrumentation - Sentry
 *
 * Initializes Sentry on the server side before any requests are handled.
 * This file is loaded before hooks.server.ts.
 *
 * Note: DSN is hardcoded because this file runs BEFORE Vite loads env vars.
 * DSN is public (only allows event submission, not data access).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
 * @see https://docs.sentry.io/concepts/key-terms/dsn-explainer/
 */
import * as Sentry from '@sentry/sveltekit';

import { createLogger } from '$lib/utils/logger';

const log = createLogger('Sentry');
const isProduction = process.env.NODE_ENV === 'production';

// DSN is public - hardcoding is the recommended approach per Sentry docs
// See: https://docs.sentry.io/concepts/key-terms/dsn-explainer/
const SENTRY_DSN =
  'https://afe0f8b38a0c3cc9c09d40f90743766a@o4510697769730048.ingest.de.sentry.io/4510697927802960';

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment identification
  environment: isProduction ? 'production' : 'development',

  // Performance Monitoring
  // Capture 100% in dev, 10% in production
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // Don't send PII by default (GDPR compliance)
  sendDefaultPii: false,
});

log.info(
  { environment: isProduction ? 'production' : 'development' },
  'Frontend server initialized',
);
