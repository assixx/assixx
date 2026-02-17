/**
 * HTML Sanitization Utilities
 * 1:1 Copy of DOMPurify config from frontend/src/utils/dom-utils.ts
 *
 * WHY: Svelte's {@html ...} directive does NOT escape content!
 * Any user-generated content rendered via {@html} is an XSS risk.
 *
 * USAGE:
 * ```svelte
 * <script>
 *   import { sanitizeHtml } from '$lib/utils';
 * </script>
 *
 * <!-- SAFE: Content is sanitized -->
 * {@html sanitizeHtml(userContent)}
 *
 * <!-- UNSAFE: XSS possible! -->
 * {@html userContent}
 * ```
 */

import { browser } from '$app/environment';

import type { Config, DOMPurify as DOMPurifyType } from 'dompurify';

// DOMPurify is browser-only, dynamically import when in browser
let purifier: DOMPurifyType | null = null;

// Initialize DOMPurify in browser environment
if (browser) {
  void import('dompurify').then((module) => {
    purifier = module.default;
  });
}

/**
 * Simple HTML escape for SSR fallback
 * Only escapes dangerous characters, preserves newlines
 */
function escapeHtmlBasic(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * DOMPurify configuration for safe HTML sanitization
 * Matches Vite frontend configuration exactly
 */
const DOMPURIFY_CONFIG = {
  FORCE_BODY: false,
  IN_PLACE: false,
  ALLOWED_TAGS: [
    // Text formatting
    'b',
    'i',
    'em',
    'strong',
    'a',
    'br',
    'p',
    'div',
    'span',
    'small',
    'code',
    'pre',
    // Lists
    'ul',
    'ol',
    'li',
    // Tables
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Media
    'img',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Forms (for embedded forms)
    'button',
    'input',
    'textarea',
    'select',
    'option',
    'label',
    // Semantic HTML5
    'header',
    'nav',
    'aside',
    'main',
    'footer',
    'section',
    'article',
    // SVG (for icons)
    'svg',
    'path',
    'circle',
    'rect',
    'line',
    'polygon',
    'polyline',
    'g',
    'defs',
    'use',
    'symbol',
  ],
  ALLOWED_ATTR: [
    // Links
    'href',
    'title',
    // Styling
    'class',
    'id',
    'style',
    // Images
    'src',
    'alt',
    'width',
    'height',
    // Forms
    'type',
    'value',
    'name',
    'for',
    'placeholder',
    'required',
    'rows',
    'cols',
    'checked',
    'selected',
    'disabled',
    'readonly',
    'maxlength',
    'minlength',
    'min',
    'max',
    'step',
    'pattern',
    'autocomplete',
    'autofocus',
    'multiple',
    // Accessibility
    'role',
    'tabindex',
    // SVG
    'viewBox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'd',
    'xmlns',
    'transform',
    'cx',
    'cy',
    'r',
    'x',
    'y',
    'rx',
    'ry',
    'points',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
  ],
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
} satisfies Config;

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Use this for any user-generated content rendered via {@html}.
 * SSR-SAFE: Uses basic escaping on server, DOMPurify in browser.
 *
 * @example
 * // In Svelte component:
 * {@html sanitizeHtml(entry.content)}
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (html === null || html === undefined || html === '') {
    return '';
  }

  // SSR fallback: basic HTML escaping (DOMPurify is browser-only)
  if (!browser || purifier === null) {
    return escapeHtmlBasic(html);
  }

  return purifier.sanitize(html, DOMPURIFY_CONFIG);
}

/**
 * Sanitize HTML with newline-to-br conversion.
 * Useful for plain text content that should preserve line breaks.
 * SSR-SAFE: Uses basic escaping on server, DOMPurify in browser.
 *
 * @example
 * {@html sanitizeWithLineBreaks(entry.content)}
 */
export function sanitizeWithLineBreaks(
  text: string | null | undefined,
): string {
  if (text === null || text === undefined || text === '') {
    return '';
  }

  // SSR fallback: basic HTML escaping (DOMPurify is browser-only)
  if (!browser || purifier === null) {
    return escapeHtmlBasic(text).replace(/\n/g, '<br>');
  }

  // Browser: full DOMPurify sanitization
  const sanitized = purifier.sanitize(text, DOMPURIFY_CONFIG);
  return sanitized.replace(/\n/g, '<br>');
}

/**
 * Escape HTML special characters (for plain text display).
 * Use this when you want to display HTML as text, not render it.
 *
 * @example
 * // Shows "<script>" as text, not executed
 * <p>{escapeHtml(userInput)}</p>
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === '') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
