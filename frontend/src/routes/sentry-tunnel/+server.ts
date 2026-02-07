/**
 * Sentry Tunnel Endpoint
 *
 * Proxies Sentry requests through our own server to bypass:
 * - Firefox Enhanced Tracking Protection
 * - Ad blockers
 * - Corporate firewalls
 *
 * @see https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
 */
import { error, isHttpError, text } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const log = createLogger('SentryTunnel');

// Sentry project configuration
const SENTRY_HOST = 'o4510697769730048.ingest.de.sentry.io';
const SENTRY_PROJECT_ID = '4510697927802960';

/**
 * POST /sentry-tunnel
 * Forwards Sentry envelope to Sentry's ingest endpoint
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const envelope = await request.text();

    // Parse the envelope header to extract the DSN
    const pieces = envelope.split('\n');
    // split() always returns at least one element, so pieces[0] is always defined
    const header = pieces[0] ?? '';

    // Empty envelopes are a known Sentry client race condition during page navigation.
    // The SDK fires before the envelope is fully assembled. Silently drop these.
    if (header === '') {
      return text('', { status: 200 });
    }

    const headerJson = JSON.parse(header) as { dsn?: string };
    const dsn = headerJson.dsn;

    if (dsn === undefined || dsn === '') {
      error(400, { message: 'Invalid Sentry envelope: missing DSN' });
    }

    // Parse and validate the DSN
    const dsnUrl = new URL(dsn);
    const projectId = dsnUrl.pathname.replace('/', '');

    // Security: Only allow our Sentry project
    if (dsnUrl.host !== SENTRY_HOST) {
      error(403, { message: 'Invalid Sentry host' });
    }

    if (projectId !== SENTRY_PROJECT_ID) {
      error(403, { message: 'Invalid Sentry project' });
    }

    // Forward to Sentry
    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
      body: envelope,
    });

    // Return Sentry's response status
    return text(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (err: unknown) {
    // Re-throw SvelteKit HttpError (from error() calls above) — don't swallow them
    if (isHttpError(err)) {
      throw err;
    }

    // Log unexpected errors but don't expose details to client
    log.error({ err }, 'Sentry tunnel error');
    error(500, { message: 'Sentry tunnel error' });
  }
};
