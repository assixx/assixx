/**
 * SvelteKit Server Hooks
 *
 * - Sentry error tracking integration
 * - Pino request logging (to Loki)
 * - HTML Minification for Production Builds
 *
 * @see https://kit.svelte.dev/docs/hooks#server-hooks
 * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
 */
import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { minify } from 'html-minifier-terser';

import { dev } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

import type { Handle, HandleServerError } from '@sveltejs/kit';

/** Logger instance for request logging */
const log = createLogger('hooks.server');

/**
 * Request logging handle
 * Logs all SSR requests with timing for observability
 */
const requestLoggingHandle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const { method } = event.request;
  const pathname = event.url.pathname;

  // Skip logging for static assets and internal routes
  if (pathname.startsWith('/_app/') || pathname.startsWith('/favicon')) {
    return await resolve(event);
  }

  try {
    const response = await resolve(event);
    const duration = Date.now() - start;

    log.info(
      {
        method,
        pathname,
        status: response.status,
        duration,
        userAgent: event.request.headers.get('user-agent')?.substring(0, 100),
      },
      `${method} ${pathname} ${response.status} ${duration}ms`,
    );

    return response;
  } catch (err) {
    const duration = Date.now() - start;

    log.error(
      {
        method,
        pathname,
        duration,
        err,
      },
      `${method} ${pathname} ERROR ${duration}ms`,
    );

    throw err;
  }
};

/**
 * HTML Minification Options
 * Matches the collapseWhitespaces: 'all' behavior from legacy frontend
 */
const minificationOptions = {
  // Whitespace handling - makes HTML single-line like Google
  collapseWhitespace: true,
  conservativeCollapse: true,

  // HTML5 optimizations
  html5: true,
  collapseBooleanAttributes: true,
  removeAttributeQuotes: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,

  // Inline CSS/JS minification
  minifyCSS: true,
  minifyJS: true,

  // Comments - IMPORTANT: Keep some for SvelteKit hydration!
  removeComments: false,
  ignoreCustomComments: [/^#/],

  // Entity handling
  decodeEntities: true,

  // Sorting for consistent output (helps with caching)
  sortAttributes: true,
  sortClassName: true,
};

/**
 * HTML Minification handle hook
 * Intercepts all requests and applies HTML minification in production
 */
const htmlMinificationHandle: Handle = async ({ event, resolve }) => {
  // Development: No minification for better debugging
  if (dev) {
    return await resolve(event);
  }

  // Production: Collect HTML chunks and minify when complete
  let pageHtml = '';

  return await resolve(event, {
    transformPageChunk: async ({ html, done }) => {
      pageHtml += html;

      if (done) {
        // Minify the complete HTML in production builds
        return await minify(pageHtml, minificationOptions);
      }

      // Return undefined to continue collecting chunks
      return undefined;
    },
  });
};

/**
 * Combined handle hook
 * Sentry tracing + Request logging + HTML minification
 */
export const handle: Handle = sequence(
  Sentry.sentryHandle(),
  requestLoggingHandle,
  htmlMinificationHandle,
);

/**
 * Server-side error handler
 * Wraps errors with Sentry capture
 */
export const handleError: HandleServerError = Sentry.handleErrorWithSentry();
