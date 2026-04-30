/**
 * Unit tests for `email-service.ts`.
 *
 * Two test groups:
 *  1) `sanitizeStyles` — narrowly scoped to the FEAT_2FA_EMAIL §2.9b
 *     regression where the previous regex `style\s*=\s*["']([^"']*)["']`
 *     used a `[^"']` character class that forbids BOTH quote types inside
 *     the value. For `style="font-family: 'Segoe UI', sans-serif"`, the
 *     regex matched up to the first inner `'` and synthesised a closing
 *     `"`, dropping `font-size`/`font-weight`/`letter-spacing` past the
 *     broken close. Symptom: token text rendered in UA-default size.
 *     Affected mails: 2FA code mail (§2.9b token), password-reset (H1/P
 *     with `-apple-system, ..., 'Segoe UI', ...` stack).
 *  2) `sanitizeHtml` end-to-end pipeline — added 2026-04-30 with the
 *     regex→sanitize-html refactor. Verifies the full default-deny
 *     allow-list, MSO-conditional preservation, head-meta handling,
 *     URL-scheme filtering, and CSS-injection strips (inline + <style>).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §2.9b
 * @see backend/src/utils/email-service.ts (SANITIZE_OPTIONS, sanitizeHtml)
 */
import { describe, expect, it } from 'vitest';

import {
  _sanitizeHtmlForTest as sanitizeHtml,
  _sanitizeStylesForTest as sanitizeStyles,
} from './email-service.js';

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

/**
 * End-to-end tests for the `sanitizeHtml()` pipeline (post 2026-04-30
 * regex→sanitize-html refactor). Verifies that the new default-deny
 * allow-list correctly handles real Email-template patterns AND blocks
 * known XSS / phishing vectors.
 *
 * What changed: the previous custom regex sanitiser pauschally stripped
 * `<meta>` and `<link>` (over-broad — every harmless `<meta charset>` and
 * `<meta viewport>` triggered a "HTML content was modified" WARN). The
 * new pipeline preserves harmless head-metas while specifically blocking
 * the phishing vector (`<meta http-equiv="refresh">`).
 */
describe('sanitizeHtml (regex→sanitize-html refactor 2026-04-30)', () => {
  describe('default-deny — known XSS vectors', () => {
    it('strips <script> tags entirely (the canonical XSS vector)', () => {
      const out = sanitizeHtml('<p>Hello</p><script>alert("xss")</script>');
      expect(out).toContain('<p>Hello</p>');
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toContain('alert');
    });

    it('strips <iframe>, <object>, <embed>, <form>, <base>, <applet>', () => {
      const dangerous = ['iframe', 'object', 'embed', 'form', 'base', 'applet'];
      for (const tag of dangerous) {
        const out = sanitizeHtml(`<p>ok</p><${tag} src="x">junk</${tag}>`);
        expect(out, `${tag} must be stripped`).not.toMatch(new RegExp(`<${tag}`, 'i'));
        expect(out).toContain('<p>ok</p>');
      }
    });

    it('strips event handlers (onclick, onerror, onload, on*)', () => {
      const out = sanitizeHtml(
        '<a href="https://x.com" onclick="alert(1)" onmouseover="bad()">click</a>',
      );
      expect(out).toContain('href="https://x.com"');
      expect(out).not.toMatch(/onclick/i);
      expect(out).not.toMatch(/onmouseover/i);
      expect(out).not.toContain('alert');
    });

    it('strips javascript: URLs in <a href>', () => {
      const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
      expect(out).not.toMatch(/javascript:/i);
    });

    it('strips vbscript: URLs in <a href>', () => {
      const out = sanitizeHtml('<a href="vbscript:msgbox(1)">click</a>');
      expect(out).not.toMatch(/vbscript:/i);
    });

    it('strips data:text/html URLs in <a href> (data:image is allowed in <img>)', () => {
      const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
      expect(out).not.toMatch(/data:text\/html/i);
    });

    it('strips <meta http-equiv="refresh"> attribute (phishing redirect vector)', () => {
      const out = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil.com">');
      // The dangerous attribute is gone — `content` may remain but is
      // harmless without `http-equiv` to interpret it.
      expect(out).not.toMatch(/http-equiv/i);
    });
  });

  describe('preserves legitimate Email-template content', () => {
    it('keeps <meta charset>, <meta name="viewport">, <meta name="color-scheme">', () => {
      const input =
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<meta name="color-scheme" content="dark only">' +
        '</head>';
      const out = sanitizeHtml(input);
      expect(out).toMatch(/<meta charset="UTF-8"/i);
      expect(out).toMatch(/<meta name="viewport"/i);
      expect(out).toMatch(/<meta name="color-scheme"/i);
    });

    it('preserves Outlook MSO-conditional comments verbatim (VML buttons)', () => {
      const input =
        '<table><tr><td>' +
        '<!--[if mso]>' +
        '<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" arcsize="50%" fillcolor="#0b70d7">' +
        '<w:anchorlock/><center>Button</center>' +
        '</v:roundrect>' +
        '<![endif]-->' +
        '<a href="https://example.com">Button</a>' +
        '</td></tr></table>';
      const out = sanitizeHtml(input);
      expect(out).toContain('<!--[if mso]>');
      expect(out).toContain('<![endif]-->');
      expect(out).toContain('v:roundrect');
      expect(out).toContain('w:anchorlock');
      expect(out).toContain('href="https://example.com"');
    });

    it('preserves multiple separate MSO-conditional comments in correct order', () => {
      // Markers chosen NOT to collide with substring `endif` (which appears
      // inside every MSO-end token `<![endif]-->`). Earlier draft used the
      // word "end" and tripped over indexOf('end') matching `endif`.
      const input =
        '<!--[if mso]><xml>SENTINEL_A</xml><![endif]-->' +
        '<p>SENTINEL_B</p>' +
        '<!--[if !mso]><!-- --><span>SENTINEL_C</span><!--<![endif]-->' +
        '<p>SENTINEL_D</p>';
      const out = sanitizeHtml(input);
      // Each marker appears, and they appear in the original order.
      expect(out).toContain('SENTINEL_A');
      expect(out).toContain('SENTINEL_B');
      expect(out).toContain('SENTINEL_D');
      expect(out.indexOf('SENTINEL_A')).toBeLessThan(out.indexOf('SENTINEL_B'));
      expect(out.indexOf('SENTINEL_B')).toBeLessThan(out.indexOf('SENTINEL_D'));
    });

    it('keeps <table> layout attributes (cellpadding/cellspacing/border/role)', () => {
      const out = sanitizeHtml(
        '<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td>x</td></tr></table>',
      );
      expect(out).toContain('cellpadding="0"');
      expect(out).toContain('cellspacing="0"');
      expect(out).toContain('role="presentation"');
    });

    it('keeps <a href="https://...">, <a href="mailto:...">, <a href="tel:...">', () => {
      expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain(
        'href="https://example.com"',
      );
      expect(sanitizeHtml('<a href="mailto:foo@bar.de">x</a>')).toContain(
        'href="mailto:foo@bar.de"',
      );
      expect(sanitizeHtml('<a href="tel:+491234">x</a>')).toContain('href="tel:+491234"');
    });

    it('keeps <img src="cid:..."> for CID-attached branding logo', () => {
      const out = sanitizeHtml('<img src="cid:assixx-logo" alt="Assixx" width="140" height="40">');
      expect(out).toContain('src="cid:assixx-logo"');
      expect(out).toContain('alt="Assixx"');
      expect(out).toContain('width="140"');
    });

    it('keeps <img src="data:image/png;base64,..."> for inline images', () => {
      const out = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">');
      expect(out).toMatch(/src="data:image\/png/);
    });

    it('preserves quoted font-family in inline styles (FEAT_2FA_EMAIL §2.9b regression)', () => {
      const out = sanitizeHtml(
        `<span style="font-family: 'SF Mono', Menlo, monospace; font-size: 40px; letter-spacing: 8px;">ABC</span>`,
      );
      expect(out).toContain("'SF Mono'");
      expect(out).toContain('font-size: 40px');
      expect(out).toContain('letter-spacing: 8px');
    });

    it('preserves Email-specific CSS properties (mso-line-height-rule, etc.)', () => {
      const out = sanitizeHtml(
        '<td style="mso-line-height-rule: exactly; line-height: 1.6;">x</td>',
      );
      expect(out).toContain('mso-line-height-rule: exactly');
      expect(out).toContain('line-height: 1.6');
    });
  });

  describe('CSS-injection strips (inline + <style>-block)', () => {
    it('strips expression() from <style>-block content', () => {
      const out = sanitizeHtml(
        '<style>.x { background: expression(alert(1)); color: red; }</style>',
      );
      expect(out).not.toMatch(/expression\s*\(/i);
      expect(out).toContain('color: red');
    });

    it('strips @import from <style>-block content', () => {
      const out = sanitizeHtml('<style>@import url("evil.css"); .x { color: red; }</style>');
      expect(out).not.toMatch(/@import/i);
      expect(out).toContain('color: red');
    });

    it('strips behavior: and -moz-binding: from <style>-block content', () => {
      const out = sanitizeHtml(
        '<style>.x { behavior: url(#bad); -moz-binding: url(bad); color: red; }</style>',
      );
      expect(out).not.toMatch(/behavior\s*:/i);
      expect(out).not.toMatch(/-moz-binding\s*:/i);
      expect(out).toContain('color: red');
    });

    it('keeps <style>-block media queries (essential for Email dark-mode)', () => {
      const input =
        '<style>@media (prefers-color-scheme: dark) { body { background: #000; } }</style>';
      const out = sanitizeHtml(input);
      expect(out).toContain('@media');
      expect(out).toContain('prefers-color-scheme');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('handles input without any HTML (plain text)', () => {
      const out = sanitizeHtml('Hello world.');
      expect(out).toContain('Hello world.');
    });

    it('does not modify clean templates (no spurious WARN trigger)', () => {
      // The whole point of the refactor: harmless head-metas no longer
      // cause WARN noise. Verify that a typical clean Email head is
      // bit-for-bit preserved.
      const input =
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>Test</title>' +
        '</head>';
      const out = sanitizeHtml(input);
      // sanitize-html may normalise whitespace; the SUBSTANTIVE content
      // must round-trip identically.
      expect(out).toContain('<meta charset="UTF-8"');
      expect(out).toContain('<meta name="viewport"');
      expect(out).toContain('<title>Test</title>');
      expect(out).not.toContain('<script');
    });
  });
});
