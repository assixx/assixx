/**
 * Sentry Example API Route
 * Tests server-side error capturing
 *
 * Note: Sentry doesn't auto-capture errors in +server.ts routes
 * We must explicitly call Sentry.captureException()
 *
 * @see https://github.com/getsentry/sentry-javascript/issues/13224
 */
import * as Sentry from '@sentry/sveltekit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const error = new Error('Sentry Example API Route Error');

  // Explicitly capture the error for Sentry
  Sentry.captureException(error);

  // Then throw it for SvelteKit error handling
  throw error;
};

export const POST: RequestHandler = () => {
  const error = new Error('Sentry Example API Route Error (POST)');

  // Explicitly capture the error for Sentry
  Sentry.captureException(error);

  // Then throw it for SvelteKit error handling
  throw error;
};
