/**
 * Unit tests for `email-service.ts` — narrowly scoped to the
 * `sanitizeStyles()` regression that broke transactional-mail rendering
 * when inline `style` attributes contained quoted CSS values like
 * `font-family: 'Segoe UI', ...`.
 *
 * Background: the previous regex `style\s*=\s*["']([^"']*)["']` used a
 * `[^"']` character class that forbids BOTH quote types inside the value.
 * For an attribute `style="font-family: 'Segoe UI', sans-serif"`, the
 * regex matched up to the first inner `'` and synthesised a closing `"`,
 * leaving the rest of the original style as garbage outside the attribute.
 * Symptom: token text rendered in UA-default size because `font-size` /
 * `font-weight` / `letter-spacing` were dropped past the broken close.
 *
 * Affected mails: 2FA code mail (§2.9b token), password-reset (H1/P
 * elements with the `-apple-system, ..., 'Segoe UI', ...` stack).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §2.9b
 * @see backend/src/utils/email-service.ts (sanitizeStyles)
 */
import { describe, expect, it } from 'vitest';

import { _sanitizeStylesForTest as sanitizeStyles } from './email-service.js';

describe('sanitizeStyles (FEAT_2FA_EMAIL §2.9b regression)', () => {
  it('preserves single-quoted font names inside double-quoted style attributes', () => {
    const input = `<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 700;">Test</h1>`;

    const out = sanitizeStyles(input);

    // The full font-family stack must survive intact.
    expect(out).toContain("'Segoe UI'");
    expect(out).toContain("'Helvetica Neue'");
    // Properties AFTER the quoted font names must still be inside `style="..."`.
    expect(out).toContain('font-size: 22px');
    expect(out).toContain('font-weight: 700');
    // No mid-attribute `"` corruption.
    expect(out).not.toMatch(/style="[^"]*"[^>]*Segoe/);
  });

  it('preserves the §2.9b token style (font-size 40px, font-weight 900, letter-spacing 8px)', () => {
    const input = `<span class="code-text" style="display: inline-block; font-family: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; font-size: 40px; font-weight: 900; letter-spacing: 8px; color: #f1f5f9; mso-line-height-rule: exactly;">ABCDEF</span>`;

    const out = sanitizeStyles(input);

    expect(out).toContain('font-size: 40px');
    expect(out).toContain('font-weight: 900');
    expect(out).toContain('letter-spacing: 8px');
    expect(out).toContain("'SF Mono'");
  });

  it('still strips dangerous CSS (regression safety net for the security side)', () => {
    const input = `<div style="font-family: 'Segoe UI'; background: expression(alert('xss')); color: red;">x</div>`;

    const out = sanitizeStyles(input);

    expect(out).not.toMatch(/expression\s*\(/i);
    // Innocent properties survive.
    expect(out).toContain("'Segoe UI'");
    expect(out).toContain('color: red');
  });

  it('strips javascript: and vbscript: from style values', () => {
    const input = `<div style="background: javascript:alert(1); color: 'red';">x</div>`;

    const out = sanitizeStyles(input);

    expect(out).not.toMatch(/javascript\s*:/i);
  });

  it('strips dangerous url() values (e.g. javascript: protocol) but keeps innocent url()', () => {
    const inputBad = `<div style="background: url('javascript:alert(1)');">x</div>`;
    const inputGood = `<div style="background: url('https://example.com/img.png');">x</div>`;

    expect(sanitizeStyles(inputBad)).not.toMatch(/javascript/i);
    expect(sanitizeStyles(inputGood)).toContain('url(');
  });

  it('handles single-quoted style attributes (rare but valid HTML)', () => {
    const input = `<h1 style='font-family: "Segoe UI", sans-serif; font-size: 22px;'>Test</h1>`;

    const out = sanitizeStyles(input);

    expect(out).toContain('"Segoe UI"');
    expect(out).toContain('font-size: 22px');
  });

  it('drops empty style attributes after sanitisation', () => {
    // Pure javascript: with nothing else — after the strip the content is
    // empty / whitespace-only, so the function drops the attribute entirely.
    const input = `<div style="javascript:">x</div>`;

    const out = sanitizeStyles(input);

    expect(out).not.toMatch(/style\s*=/);
  });
});
