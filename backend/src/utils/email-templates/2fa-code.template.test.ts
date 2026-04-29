/**
 * Unit tests for build2faCodeTemplate.
 *
 * Scope: pure-function template builder. We're locking down the DD-13
 * invariants (generic subject, code in body only, plain-text fallback
 * coherence) so a future "let's tweak the wording" PR can't accidentally
 * regress the security properties documented in
 * FEAT_2FA_EMAIL_MASTERPLAN §2.9.
 */
import { describe, expect, it } from 'vitest';

import { build2faCodeTemplate } from './2fa-code.template.js';

describe('build2faCodeTemplate', () => {
  // ===========================================================================
  // DD-13 — generic subject, no code/purpose leakage
  // ===========================================================================

  it('uses the same generic subject for login and signup (DD-13)', () => {
    const login = build2faCodeTemplate({ code: 'ABC234', purpose: 'login', ttlMinutes: 10 });
    const signup = build2faCodeTemplate({ code: 'ABC234', purpose: 'signup', ttlMinutes: 10 });

    expect(login.subject).toBe('Ihr Bestätigungscode für Assixx');
    expect(signup.subject).toBe(login.subject);
  });

  it('does not leak the code into the subject (DD-13)', () => {
    const result = build2faCodeTemplate({ code: 'XYZ789', purpose: 'login', ttlMinutes: 10 });

    expect(result.subject).not.toContain('XYZ789');
  });

  // ===========================================================================
  // Code rendering — body presence + correct value
  // ===========================================================================

  it('renders the code in both HTML and text bodies', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 10 });

    expect(result.html).toContain('K7PX3M');
    expect(result.text).toContain('K7PX3M');
  });

  it('renders the TTL in both HTML and text bodies', () => {
    const result = build2faCodeTemplate({ code: 'K7PX3M', purpose: 'login', ttlMinutes: 7 });

    expect(result.html).toContain('7 Minuten');
    expect(result.text).toContain('7 Minuten');
  });

  // ===========================================================================
  // Per-purpose copy — login vs signup
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
});
