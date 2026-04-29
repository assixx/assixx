/**
 * Unit tests for build2faCodeTemplate.
 *
 * Scope: pure-function template builder. We're locking down the DD-13
 * invariants (generic subject, code in body only, plain-text fallback
 * coherence) AND the §2.9b redesign invariants (6-box code rendering,
 * Klarna-DE action-oriented copy, deleted-phrase regression) so a future
 * "let's tweak the wording" PR can't accidentally regress security or
 * visual properties.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9 + §2.9b)
 */
import { describe, expect, it } from 'vitest';

import { build2faCodeTemplate } from './2fa-code.template.js';

describe('build2faCodeTemplate', () => {
  // ===========================================================================
  // DD-13 — generic subject, no code/purpose leakage
  // ===========================================================================

  it('uses the same generic subject for every purpose (DD-13)', () => {
    const login = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });
    const signup = build2faCodeTemplate({ code: 'ABC234', purpose: 'signup', ttlMinutes: 10 });
    const changeOld = build2faCodeTemplate({
      code: 'ABC234',
      purpose: 'email-change-old',
      ttlMinutes: 10,
    });
    const changeNew = build2faCodeTemplate({
      code: 'ABC234',
      purpose: 'email-change-new',
      ttlMinutes: 10,
    });

    expect(login.subject).toBe('Ihr Bestätigungscode für Assixx');
    expect(signup.subject).toBe(login.subject);
    expect(changeOld.subject).toBe(login.subject);
    expect(changeNew.subject).toBe(login.subject);
  });

  it('does not leak the literal code into the subject (DD-13)', () => {
    const result = build2faCodeTemplate({ code: 'XYZ789', purpose: 'login', ttlMinutes: 10 });

    expect(result.subject).not.toContain('XYZ789');
  });

  // §2.9b regression lock — for ANY 6-char Crockford-Base32 code, the
  // subject must never match it. Stronger than the literal-string check
  // above: if a future tweak templates the code into the subject, this
  // assertion catches it.
  it('subject never contains a 6-char alphanumeric pattern matching the code (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 10 });

    expect(result.subject).not.toMatch(/[A-Z2-9]{6}/);
  });

  // ===========================================================================
  // Code rendering — body presence + 6 separate boxes (§2.9b)
  // ===========================================================================

  // §2.9b v4 (2026-04-29): HTML renders the code as a single bold-monospace
  // text block, centered, no boxes. Unbroken code is in BOTH HTML and text
  // bodies — clipboard-copy yields the unbroken string from either.
  it('renders the code (unbroken) in both HTML and plain-text bodies (§2.9b v4)', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('K7PX3M');
    expect(result.text).toContain('K7PX3M');
  });

  // §2.9b v4 (2026-04-29): plain bold monospace token, no boxes. Single
  // <span class="code-text"> wraps the unbroken code in the rendered card.
  // Centering is handled by the parent <td align="center"; text-align: center>.
  it('renders the code as a single bold monospace span with the unbroken code (§2.9b v4)', () => {
    const code = 'K7PX3M';
    const result = build2faCodeTemplate({ code, purpose: 'login', ttlMinutes: 10 });

    const tokenPattern = /<span class="code-text"[^>]*>([A-Z2-9]{6})<\/span>/;
    const match = result.html.match(tokenPattern);

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(code);
  });

  it('styles the code as bold monospace with letter-spacing (§2.9b v4)', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 10 });

    const tokenPattern = /<span class="code-text"[^>]*>[A-Z2-9]{6}<\/span>/;
    const match = result.html.match(tokenPattern);

    expect(match).not.toBeNull();
    const tag = match?.[0] ?? '';
    expect(tag).toContain('font-weight: 800');
    expect(tag).toContain('monospace');
    expect(tag).toContain('letter-spacing');
  });

  it('renders the TTL in both HTML and text bodies', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 7 });

    expect(result.html).toContain('7 Minuten');
    expect(result.text).toContain('7 Minuten');
  });

  // ===========================================================================
  // Per-purpose copy — login / signup / email-change-old / email-change-new
  // ===========================================================================

  it('uses signup-specific intro copy for purpose=signup', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'signup', ttlMinutes: 10 });

    expect(result.html).toContain('Willkommen bei Assixx');
    expect(result.text).toContain('Willkommen bei Assixx');
  });

  it('uses login-specific intro copy for purpose=login', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('Sie haben sich gerade bei Assixx angemeldet');
    expect(result.text).toContain('Sie haben sich gerade bei Assixx angemeldet');
  });

  // ===========================================================================
  // §2.9b — Klarna-DE action-oriented copy
  // ===========================================================================

  it('contains the Klarna-style "did you not request this code?" advisory (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('Sie haben keinen Code angefordert');
    expect(result.text).toContain('Sie haben keinen Code angefordert');
    expect(result.html).toContain('sperren Sie Ihr Konto');
    expect(result.text).toContain('sperren Sie Ihr Konto');
    expect(result.html).toContain('IT-Abteilung');
    expect(result.text).toContain('IT-Abteilung');
  });

  it('contains the Klarna-style fraud warning (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('Betrüger geben sich möglicherweise als Assixx aus');
    expect(result.text).toContain('Betrüger geben sich möglicherweise als Assixx aus');
  });

  it('uses the action-oriented "Verwenden Sie diesen Code" verb (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('Verwenden Sie diesen Code');
    expect(result.text).toContain('Verwenden Sie diesen Code');
  });

  // §2.9b regression: the §2.9 passive closing was removed.
  it('does NOT contain the deprecated passive "Falls Sie diese E-Mail nicht erwartet" closing (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).not.toContain('Falls Sie diese E-Mail nicht erwartet haben');
    expect(result.text).not.toContain('Falls Sie diese E-Mail nicht erwartet haben');
  });

  // ===========================================================================
  // Phishing mitigation — "do not share" warning
  // ===========================================================================

  it('always includes the do-not-share warning in HTML and text', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('Geben Sie diesen Code niemandem weiter');
    expect(result.text).toContain('Geben Sie diesen Code niemandem weiter');
  });

  // ===========================================================================
  // Plain-text fallback always present (DD-13 mail-client compat)
  // ===========================================================================

  it('always returns a non-empty plain-text fallback', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.text.length).toBeGreaterThan(0);
    // No HTML tags in the text fallback — verify the most common ones don't bleed in.
    expect(result.text).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  // ===========================================================================
  // No external assets — no tracking pixels, no remote URLs
  // ===========================================================================

  it('does not embed external HTTP(S) image URLs (no tracking pixels)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).not.toMatch(/<img[^>]+src=["']https?:/i);
  });

  it('does not contain script tags', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).not.toMatch(/<script\b/i);
  });

  // §2.9b: logo MUST be referenced via cid:assixx-logo (matches the
  // password-reset shell + the attachment wired in email-service.send2faCode).
  it('references the branding logo via cid:assixx-logo (§2.9b)', () => {
    const result = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('src="cid:assixx-logo"');
  });
});
