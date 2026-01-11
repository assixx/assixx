/**
 * SvelteKit Server Hooks
 *
 * HTML Minification for Production Builds
 * Equivalent to vite-plugin-simple-html in legacy frontend
 *
 * @see https://kit.svelte.dev/docs/hooks#server-hooks
 */
import { minify } from 'html-minifier-terser';

import { dev } from '$app/environment';

import type { Handle } from '@sveltejs/kit';

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
 * Server-side handle hook
 * Intercepts all requests and applies HTML minification in production
 */
export const handle: Handle = async ({ event, resolve }) => {
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
        // html-minifier-terser v7 returns Promise<string>
        return await minify(pageHtml, minificationOptions);
      }

      // Return undefined to continue collecting chunks
      return undefined;
    },
  });
};
