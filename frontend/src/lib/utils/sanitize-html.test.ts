/**
 * Unit tests for HTML Sanitization
 *
 * Phase 7: Frontend utils — 1 test per function.
 * Tests run in SSR mode (browser=false from $app/environment mock).
 * sanitizeHtml uses escapeHtmlBasic fallback, DOMPurify not loaded.
 */
import { describe, expect, it } from 'vitest';

import { escapeHtml, sanitizeHtml } from './sanitize-html.js';

describe('sanitize-html', () => {
  it('escapeHtml should escape all dangerous characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("it's a test & more")).toBe('it&#039;s a test &amp; more');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('sanitizeHtml should use SSR fallback escaping when browser is false', () => {
    const result = sanitizeHtml('<img src=x onerror=alert(1)>');

    // SSR mode: escapeHtmlBasic escapes all HTML
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});
